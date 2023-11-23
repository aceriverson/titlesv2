const express = require('express');
const session = require('express-session');
const polyline = require('polyline');

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
      console.error('Error executing query:', error);
      res.sendStatus(500);
      return;
  }

  res.sendStatus(200);
});

app.use('/api/v2/delete', express.json())
app.post('/api/v2/delete', async (req, res) => {
  if (!req.session.user) {
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
      console.error('Error executing query:', error);
      res.sendStatus(500);
      return;
  }

  res.sendStatus(200);
});

app.use('/api/v2/edit', express.json());
app.post('/api/v2/edit', async (req, res) => {
  if (!req.session.user) {
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
      console.error('Error executing query:', error);
      res.sendStatus(500);
      return;
  }

  res.sendStatus(200);
});

app.get('/api/v2/polygons', async (req, res) => {
  if (!req.session?.user?.athlete?.id) {
    res.sendStatus(401)
    return;
  }

  if (reg.session.user.athlete.id == 73667316) {
    res.session.user.athlete.id = "*";
  }

  try {
    const query = "SELECT owner, name, puid, ST_AsText(geom) FROM polygons WHERE owner = $1";
    const values = [req.session.user.athlete.id];

    const client = await pool.connect();
    const result = await client.query(query, values);
    client.release();

    res.send(result)

  } catch (error) {
    console.error('Error executing query:', error);
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
  }

  res.send(userData);
});

app.use('/auth/webhook', express.json())
app.all('/auth/webhook', async (req, res) => {
    if (req.query['hub.challenge'] && req.query['hub.verify_token'] == process.env.WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send({
            "hub.challenge": req.query['hub.challenge']
        })
    } else if (req?.body?.subscription_id == process.env.WEBHOOK_SUBSCRIPTION) {
        if (req.body?.updates?.authorized ==  'false') {
            console.log("user unauthenticated")
            console.log(req.body?.owner_id)

            try {
              const query = "DELETE FROM users WHERE id = $1";
              const values = [req.body?.owner_id];

              const client = await pool.connect();
              const result = await client.query(query, values);
              client.release();

            } catch (error) {
              console.error('Error executing query:', error);
            }
        } else if (req.body?.object_type == 'activity' && req.body?.aspect_type == 'create') {
          let user_bearer;
          try {
            const query = "SELECT id, access_token, refresh_token, expires_at FROM users WHERE id = $1";
            const values = [req.body.owner_id];
        
            const client = await pool.connect();
            const result = await client.query(query, values);
            client.release();

            user_bearer = result.rows[0].access_token;
        
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
                console.log(`error refreshing token: ${req.body.owner_id}`);
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
                  console.error('Error executing query:', error);
                  res.sendStatus(500);
                  return;
                }
            }
          }

          let data = await fetch(`https://www.strava.com/api/v3/activities/${req.body.object_id}`, {headers: {'Authorization': `Bearer ${user_bearer}`, 'Content-Type': 'application/json',}})
          let json = await data.json()

          if (json.errors) {
            console.error(`Error getting activity: ${req.body.object_id}`);
            console.log(json)
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

            console.log(result)

            if (result.rows.length > 0) {
              const body = {
                name: result.rows[0].polygon_name
              }

              let data = await fetch(`https://www.strava.com/api/v3/activities/${req.body.object_id}`, {method: 'PUT', body: JSON.stringify(body), headers: {'Authorization': `Bearer ${user_bearer}`, 'Content-Type': 'application/json',}})
              let json = await data.json()

              if (json.errors) {
                console.error(`Error renaming activity: ${req.body.object_id}`);
                console.log(json)
                res.sendStatus(500);
                return;
              }

              console.log(`Activity ${req.body.object_id} renamed to ${result.rows[0].polygon_name}`)

              res.sendStatus(200);
              return;
            }
    
          } catch (error) {
            console.error('Error executing query:', error);
            res.sendStatus(500);
            return;
          }
          
        } catch (error) {
          console.error('Error executing query:', error);
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
        console.error('Error executing query:', error);
      }

      req.session.user = json
      res.redirect('/titles');
  } else {
      console.log("Bad OAuth request")
      res.send('Error')
  }
})

app.get('/auth/login', (req, res) => {
  res.redirect(`https://www.strava.com/oauth/authorize?client_id=${process.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=https://acer.fyi/titles/auth/exchange_token&approval_prompt=auto&scope=activity:write,activity:read_all`)
})

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/titles');
})

app.get('/v2', (req, res) => res.redirect('/titles'));

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
