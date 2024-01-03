const express = require('express');
const session = require('express-session');
const polyline = require('polyline');
const StaticMaps = require('staticmaps')
const winston = require('winston');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'titles.run/v2' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'titles.log' }),
  ],
});

app.use(express.static(__dirname + '/../frontend/public'));

// Configure the session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use('/api/v2/create', express.json());
app.post('/api/v2/create', async (req, res) => {
  if (!req.session.user) {
      res.sendStatus(401);
      return;
  }

  let polygon = "POLYGON ((";
  req.body.latlngs.forEach((latlng) => {
      polygon += `${latlng.lng} ${latlng.lat}, `
  })
  polygon += `${req.body.latlngs[0].lng} ${req.body.latlngs[0].lat}))`

  try {
      const query = "INSERT INTO polygons (owner, name, puid, geom) VALUES ($1, $2, $3, $4)";
      const values = [req.session.user.athlete.id, req.body.name, req.body.id, polygon];

      const client = await pool.connect();
      const result = await client.query(query, values);
      client.release();

  } catch (error) {
      logger.error({
        message: "Error executing query",
        data: error
      })
      res.sendStatus(500);
      return;
  }

  res.sendStatus(200);
});

app.use('/api/v2/delete', express.json())
app.post('/api/v2/delete', async (req, res) => {
  if (!req.session.user) {
    logger.error({
      message: "Invalid user in /delete"
    })
    res.sendStatus(401)
    return;
  };

  try {
    const query = "DELETE FROM polygons WHERE owner = $1 AND puid = $2";
    const values = [req.session.user.athlete.id, req.body.id];

    const client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

  } catch (error) {
      logger.error({
        message: "Error executing query",
        data: error
      })
      res.sendStatus(500);
      return;
  }

  console.info({
    message: "Attempted to delete polygon",
    user: req.session.user.athlete.id,
    polygon: req.body.id
  })

  res.sendStatus(200);
});

app.use('/api/v2/edit', express.json());
app.post('/api/v2/edit', async (req, res) => {
  if (!req.session.user) {
    logger.error({
      message: "Invalid user in /delete"
    })
    res.sendStatus(401)
    return;
  };

  let polygon = "POLYGON ((";
  req.body.latlngs.forEach((latlng) => {
      polygon += `${latlng.lng} ${latlng.lat}, `
  })
  polygon += `${req.body.latlngs[0].lng} ${req.body.latlngs[0].lat}))`

  try {
    const query = "UPDATE polygons SET geom = $1 WHERE owner = $2 AND puid = $3";
    const values = [polygon, req.session.user.athlete.id, req.body.id];

    const client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

  } catch (error) {
      logger.error({
        message: "Error executing query",
        data: error
      })
      res.sendStatus(500);
      return;
  }

  logger.info({
     message: "Attempted to edit polygon",
     user: req.session.user.athlete.id,
     polygon: req.body.id

  })

  res.sendStatus(200);
});

app.get('/api/v2/polygons', async (req, res) => {
  if (!req.session?.user?.athlete?.id) {
    logger.error({
      message: "Invalid user in /delete"
    })
    res.sendStatus(401)
    return;
  }

  try {

    let query = "SELECT owner, name, puid, ST_AsText(geom) FROM polygons WHERE owner = $1";
    let values = [req.session.user.athlete.id];

    if (req.session.user.athlete.id == 73667316) {
        query = "SELECT owner, name, puid, ST_AsText(geom) FROM polygons";
        values = [];
    }

    const client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

    logger.info({
      message: "Getting polygons",
      user: req.session.user.athlete.id
    })

    res.send(result)

  } catch (error) {
    logger.error({
      message: "Error executing query",
      data: error
    })
    res.sendStatus(500);
  }
})

app.get('/api/v2/user', (req, res) => {
  let userData = {};

  if (req.session?.user) {
    userData = {
      id: req.session.user.athlete.id,
      pic: req.session.user.athlete.profile,
      name: req.session.user.athlete.username
    };

    logger.info({
      message: "Getting user info",
      user: req.session.user.athlete.id
    })
  }

  res.send(userData);
});

app.get('/api/v2/user_count', async (req, res) => {
  try {
    let query = "SELECT count(id) FROM users";

    const client = await pool.connect();
    const result = await client.query(query);
    client.release();

    logger.info({
      message: "Getting user count",
      data: result.rows[0]
    })

    res.send(result.rows[0]);

  } catch (error) {
    logger.error({
      message: "Error executing query",
      data: error
    })
    res.sendStatus(500);
  }
});

app.use('/auth/webhook', express.json())
app.all('/auth/webhook', async (req, res) => {
    logger.info({
      message: "Webhook recieved",
      data: req?.body
    })
    if (req.query['hub.challenge'] && req.query['hub.verify_token'] == process.env.WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send({
            "hub.challenge": req.query['hub.challenge']
        })
    } else if (req?.body?.subscription_id == process.env.WEBHOOK_SUBSCRIPTION) {
        if (req.body?.updates?.authorized ==  'false') {
            logger.info({
              message: "User unauthenticated",
              data: req.body?.owner_id
            })

            try {
              const query = "DELETE FROM users WHERE id = $1";
              const values = [req.body?.owner_id];

              const client = await pool.connect();
              const result = await client.query(query, values);
              client.release();

            } catch (error) {
              logger.error({
                message: "Error executing query",
                data: error
              })
            }
        } else if (req.body?.object_type == 'activity' && req.body?.aspect_type == 'create') {
          let user_bearer;
          try {
            const query = "SELECT id, access_token, refresh_token, expires_at, ai FROM users WHERE id = $1";
            const values = [req.body.owner_id];
        
            const client = await pool.connect();
            const result = await client.query(query, values);
            client.release();

            user_bearer = result.rows[0].access_token;
            ai_enabled = result.rows[0].ai;
        
            if (result.rows[0].expires_at < (Date.now() / 1000)) {
              const body = {
                      client_id: process.env.STRAVA_CLIENT_ID,
                      client_secret: process.env.STRAVA_CLIENT_SECRET,
                      grant_type: "refresh_token",
                      refresh_token: result.rows[0].refresh_token
              }

              let data = await fetch(`https://www.strava.com/api/v3/oauth/token`, { method: "POST", body: JSON.stringify(body), headers: {'Content-Type': 'application/json'} })
              let json = await data.json()

              user_bearer = json.access_token;
                
              if (json.errors) {
                logger.error({
                  message: "Error refreshing token",
                  user: req.body.owner_id,
                  data: json.errors
                })
                res.sendStatus(500);
                return;
              } else {
                try {
                  const query = `UPDATE users
                                 SET access_token = $1, refresh_token = $2, expires_at = $3
                                 WHERE id = $4`;
                  const values = [json.access_token, json.refresh_token, json.expires_at, req.body.owner_id];
          
                  const client = await pool.connect();
                  const result = await client.query(query, values);
                  client.release();
          
                } catch (error) {
                  logger.error({
                    message: "Error executing query",
                    data: error
                  })
                  res.sendStatus(500);
                  return;
                }
            }
          }

          let data = await fetch(`https://www.strava.com/api/v3/activities/${req.body.object_id}`, {headers: {'Authorization': `Bearer ${user_bearer}`, 'Content-Type': 'application/json',}})
          let json = await data.json()

          if (json.errors) {
            logger.error({
              message: "Error getting activity",
              activity: req.body.object_id,
              data: json.errors
            })
            res.sendStatus(500);
            return;
          }

          if (!json?.map?.polyline) {
            res.sendStatus(200);
            return;
          }

          const decodedCoords = polyline.decode(json.map.polyline);

          let polystr = "LINESTRING ("
          decodedCoords.forEach((coord) => {
            polystr += `${coord[1]} ${coord[0]}, `
          });
          polystr = polystr.slice(0, -2)
          polystr += ")"

          const summary_polyline = json.map.summary_polyline

          try {
            const query = `WITH input_linestring AS (
                             SELECT ST_GeomFromText($1, 4326) AS geom
                           )
                           SELECT polygons.id AS polygon_id, polygons.name as polygon_name, ST_Distance(polygons.geom, ST_StartPoint(input_linestring.geom)) as distance
                           FROM polygons
                           JOIN input_linestring ON ST_Intersects(input_linestring.geom, polygons.geom)
                           WHERE owner=$2
                           ORDER BY ST_LineLocatePoint(input_linestring.geom, ST_StartPoint(polygons.geom))`;
            const values = [polystr, req.body.owner_id];
    
            const client = await pool.connect();
            const result = await client.query(query, values);
            client.release();

            if (result.rows.length > 0) {
              let body = {};

              if (ai_enabled) {
                const options = {
                  width: 720,
                  height: 720,
                  paddingX: 30,
                  paddingY: 30,
                  // tileUrl: "https://cartodb-basemaps-b.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png"
                  tileUrl: `https://api.mapbox.com/styles/v1/aceriverson/clc3rc6bn000315qbmb44aaaw/tiles/256/{z}/{x}/{y}?access_token=${process.env.MAPBOX_KEY}&tilesize=600`
                }
                const map = new StaticMaps(options)

                let poly = polyline.decode(summary_polyline)
                poly.forEach((item, i) => {
                    poly[i] = item.reverse()
                })
                req.body.polyline = poly
            
                const polyline_options = {
                    coords: req.body.polyline,
                    color: '#FC5200',
                    width: 10
                }
                map.addLine(polyline_options)
            
                if (req.body.polyline.length > 0) {
                    map.addCircle({
                        coord: req.body.polyline[0],
                        radius: 5,
                        fill: '#FC5200',
                        width: 0
                    })
            
                    map.addCircle({
                        coord: req.body.polyline[req.body.polyline.length - 1],
                        radius: 5,
                        fill: '#FC5200',
                        width: 0
                    })
                }
            
                await map.render()

                const buffer = await map.image.buffer('image/png', { quality: 75 })
                const base64Image = buffer.toString('base64');
                const formattedBase64 = `data:image/png;base64,${base64Image}`;

                const open_ai_body = {
                  "model": "gpt-4-vision-preview",
                  "messages": [
                    {
                      "role": "user",
                      "content": [
                        {
                          "type": "text",
                          "text": `Can you give a title to the strava ${req.body.sport_type} activity done in the map I have attached? I would like the title to be simple like a normal strava activity title, but include the natural features and locations around. A suggested location from the map is \"${result.rows[0].polygon_name}\". Just give the title without quotation marks and no other text please.`
                        },
                        {
                          "type": "image_url",
                          "image_url": {
                            "url": formattedBase64
                          }
                        }
                      ]
                    }
                  ],
                  "max_tokens": 300
                }

                let data = await fetch("https://api.openai.com/v1/chat/completions", {method: 'POST', body: JSON.stringify(open_ai_body), headers: {'Authorization': `Bearer ${process.env.OPENAI_KEY}`, 'Content-Type': 'application/json'}})
                let json = await data.json()

                if (json.errors) {
                  logger.error({
                    message: "Error communicating with OpenAI",
                    activity: req.body.object_id,
                    data: json.errors
                  })
                  res.sendStatus(500);
                  return;
                }

                body = {
                  name: json.choices[0].message.content,
                  description: "Titled by titles.run/ai (beta)"
                }
              } else {
                body = {
                  name: result.rows[0].polygon_name,
                  description: "Titled by titles.run/v2 (beta)"
                }
              }

              let data = await fetch(`https://www.strava.com/api/v3/activities/${req.body.object_id}`, {method: 'PUT', body: JSON.stringify(body), headers: {'Authorization': `Bearer ${user_bearer}`, 'Content-Type': 'application/json',}})
              let json = await data.json()

              if (json.errors) {
                logger.error({
                  message: "Error renaming activity",
                  activity: req.body.object_id,
                  data: json.errors
                })
                res.sendStatus(500);
                return;
              }

              logger.info({
                message: "Activity renamed",
                activity: req.body.object_id,
                data: body.name
              })

              res.sendStatus(200);
              return;
            } else if (ai_enabled) {
              const options = {
                width: 720,
                height: 720,
                paddingX: 30,
                paddingY: 30,
                // tileUrl: "https://cartodb-basemaps-b.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png"
                tileUrl: `https://api.mapbox.com/styles/v1/aceriverson/clc3rc6bn000315qbmb44aaaw/tiles/256/{z}/{x}/{y}?access_token=${process.env.MAPBOX_KEY}&tilesize=600`
              }
              const map = new StaticMaps(options)

              let poly = polyline.decode(summary_polyline)
              poly.forEach((item, i) => {
                  poly[i] = item.reverse()
              })
              req.body.polyline = poly
          
              const polyline_options = {
                  coords: req.body.polyline,
                  color: '#FC5200',
                  width: 10
              }
              map.addLine(polyline_options)
          
              if (req.body.polyline.length > 0) {
                  map.addCircle({
                      coord: req.body.polyline[0],
                      radius: 5,
                      fill: '#FC5200',
                      width: 0
                  })
          
                  map.addCircle({
                      coord: req.body.polyline[req.body.polyline.length - 1],
                      radius: 5,
                      fill: '#FC5200',
                      width: 0
                  })
              }
          
              await map.render()

              const buffer = await map.image.buffer('image/png', { quality: 75 })
              const base64Image = buffer.toString('base64');
              const formattedBase64 = `data:image/png;base64,${base64Image}`;

              const open_ai_body = {
                "model": "gpt-4-vision-preview",
                "messages": [
                  {
                    "role": "user",
                    "content": [
                      {
                        "type": "text",
                        "text": `Can you give a title to the strava ${req.body.sport_type} activity done in the map I have attached? I would like the title to be simple like a normal strava activity title, but include the natural features and locations around. Just give the title without quotation marks and no other text please.`
                      },
                      {
                        "type": "image_url",
                        "image_url": {
                          "url": formattedBase64
                        }
                      }
                    ]
                  }
                ],
                "max_tokens": 300
              }

              let data = await fetch("https://api.openai.com/v1/chat/completions", {method: 'POST', body: JSON.stringify(open_ai_body), headers: {'Authorization': `Bearer ${process.env.OPENAI_KEY}`, 'Content-Type': 'application/json'}})
              let json = await data.json()

              if (json.errors) {
                logger.error({
                  message: "Error communicating with OpenAI",
                  activity: req.body.object_id,
                  data: json.errors
                })

                res.sendStatus(500);
                return;
              }

              const body = {
                name: json.choices[0].message.content,
                description: "Titled by titles.run/ai (beta)"
              }

              data = await fetch(`https://www.strava.com/api/v3/activities/${req.body.object_id}`, {method: 'PUT', body: JSON.stringify(body), headers: {'Authorization': `Bearer ${user_bearer}`, 'Content-Type': 'application/json',}})
              json = await data.json()

              if (json.errors) {
                logger.error({
                  message: "Error renaming activity",
                  activity: req.body.object_id,
                  data: json.errors
                })
                res.sendStatus(500);
                return;
              }

              logger.info({
                message: "Activity renamed",
                activity: req.body.object_id,
                data: body.name
              })

              res.sendStatus(200);
              return;
            }
    
          } catch (error) {
            logger.error({
              message: "Error executing query",
              data: error
            })
            res.sendStatus(500);
            return;
          }
          
        } catch (error) {
          logger.error({
            message: "Error executing query",
            data: error
          })
          res.sendStatus(500);
          return;
        }

        res.sendStatus(200)
        return;
    } else {
        res.sendStatus(500);
        return;
    }
  }
})

app.get('/auth/exchange_token', async (req, res) => {
  if (req?.query?.scope != "read,activity:write,activity:read_all") {
      logger.error({
        message: "Invalid scope in /auth/exchange_token",
      })
      res.send('invalid scope')
      return
  }
  let token_exchange = await fetch(`https://www.strava.com/oauth/token?client_id=${process.env.STRAVA_CLIENT_ID}&client_secret=${process.env.STRAVA_CLIENT_SECRET}&code=${req.query.code}&grant_type=authorization_code`, {method: 'POST'})
  let json = await token_exchange.json()

  if (!json.errors) {
      try {
        const query = `INSERT INTO users(id, access_token, refresh_token, expires_at, athlete)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (id) DO UPDATE
                       SET access_token = EXCLUDED.access_token,
                           refresh_token = EXCLUDED.refresh_token,
                           expires_at = EXCLUDED.expires_at,
                           athlete = EXCLUDED.athlete;`;
        const values = [json.athlete.id, json.access_token, json.refresh_token, json.expires_at, json.athlete];

        const client = await pool.connect();
        const result = await client.query(query, values);
        client.release();

      } catch (error) {
        logger.error({
          message: "Error executing query",
          data: error
        })
      }

      logger.info({
        message: "User signed in/up",
        user: json.athlete.id
      })

      req.session.user = json
      res.redirect('/titles');
  } else {
      logger.error({
        message: "Bad OAuth request",
        data: json.errors
      })
      res.send('Error')
  }
})

app.get('/auth/login', (req, res) => {
  res.redirect(`https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=https://iver.sn/titles/auth/exchange_token&approval_prompt=auto&scope=activity:write,activity:read_all`)
})

app.get('/auth/logout', (req, res) => {
  logger.info({
    message: "User logging out",
    user: req.session?.user?.athlete.id
  })
  req.session.destroy();
  res.redirect('/titles');
})

app.get('/v2', (req, res) => res.redirect('/titles'));

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
