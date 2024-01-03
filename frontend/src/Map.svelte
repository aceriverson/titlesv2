<script>
    import { onMount } from 'svelte';
    import PopUp from './PopUp.svelte';
    import L from 'leaflet';
    import 'leaflet-draw';
    import 'leaflet/dist/leaflet.css';
    import 'leaflet-draw/dist/leaflet.draw.css';

    import { showMapTools, mapLocation, user } from './stores.js';

    let map;
    // let routes = {};

    let drawControl;
    let tileControl;
    let zoomControl;
    let attrControl;
    let drawnItems;

    let currentPolygonEvent; 

    const loadPolygons = async () => {
        const response = await fetch('/titles/api/v2/polygons');
        const polygons = await response.json();

        polygons.rows.forEach((polygon) => {
            let coords1 = polygon.st_astext.slice(9, -2);
            let coords2 = coords1.split(',')
            let coords = []
            coords2.forEach((coord) => {
                let t = coord.split(' ')
                coords.push([parseFloat(t[1]), parseFloat(t[0])])
            })

            const p = L.polygon(coords);

	    if ($user?.id == 73667316) {
	        polygon.name = polygon.name + polygon.owner
            }

            p.bindTooltip(polygon.name, {direction: 'center'});
            p.options.id = polygon.puid;
            p.setStyle({opacity: 0.5});

            drawnItems.addLayer(p)
        })
    }

    $: if ($user?.id && map) {
        loadPolygons();
    }

    $: if (!$showMapTools) {
        map.removeControl(drawControl)
        map.removeControl(tileControl)
        map.removeControl(attrControl)
        map.removeControl(zoomControl)
    }

    $: if ($showMapTools && map) {
        drawControl.addTo(map)
        tileControl.addTo(map)
        attrControl.addTo(map)
        zoomControl.addTo(map)
        document.querySelector('.leaflet-control-layers-toggle').innerHTML = '<i class="ri-map-2-line"></i>'
    }

    $: if (map && $mapLocation) {
        map.flyTo($mapLocation);
    }

    const createPolygon = (e) => {

        const layer = e.layer;
        // let label = window.prompt("Label")

        layer.bindTooltip(e.label, {
            direction: 'center',
        });

        layer.options.id = generateUniqueId();

        drawnItems.addLayer(layer);

        const data = {
            latlngs: layer._latlngs[0],
            name: layer._tooltip._content,
            id: layer.options.id,
        };

        fetch('/titles/api/v2/create', 
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            }
        ).catch(error => {
            console.error('Error:', error);
        });

        currentPolygonEvent = null;
    }

    const deletePolygon = (e) => {
        e.layers.eachLayer((layer) => {
            const data = {
                latlngs: layer._latlngs[0],
                name: layer._tooltip._content,
                id: layer.options.id
            };
            console.log(data);

            fetch('/titles/api/v2/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                })
                .catch(error => {
                    console.error('Error:', error);
            });
        });

        currentPolygonEvent = null;
    }

    onMount(async () => {
        map = L.map('map', {zoomControl: false, attributionControl: false,}).setView([localStorage.getItem("centerLat") || 42.3602534, localStorage.getItem("centerLng") || -71.0582912], localStorage.getItem("zoomLvl") || 13);
        attrControl = L.control.attribution({position: 'bottomleft'}).addTo(map);
        zoomControl = L.control.zoom().addTo(map);
        const defaultTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png').addTo(map);

        // Add a tile layer (you can use your preferred tile provider)
        const tileLayers = {
            'Light': defaultTileLayer,
            'Street': L.tileLayer('https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=0c477hdBnHqQ1OJyLoCZtf0idIX7gclZwrB04OsmW0VrWtspp3ff05PuxehYuwLT', {attribution: "<a href=\"https://www.jawg.io\" target=\"_blank\">&copy; Jawg</a> - <a href=\"https://www.openstreetmap.org\" target=\"_blank\">&copy; OpenStreetMap</a>&nbsp;contributors"}),
            'Terrain': L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
        }

        tileControl = L.control.layers(tileLayers, null, {position: 'bottomright'}).addTo(map);
        document.querySelector('.leaflet-control-layers-toggle').innerHTML = '<i class="ri-map-2-line"></i>'


        // Add the drawing control to the map
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
                removeAllLayers: false,
            },
            draw: {
                polygon: true,
                circle: false,
                marker: false,
                circlemarker: false,
                polyline: false,
                rectangle: false,
            },
        });

        // Listen for drawing events
        map.on(L.Draw.Event.CREATED, (e) => {
            currentPolygonEvent = e;
        });

        map.on('draw:edited', (e) => {
            Object.values(e.layers._layers).forEach((layer) => {
                const data = {
                    latlngs: layer._latlngs[0],
                    name: layer._tooltip._content,
                    id: layer.options.id
                };
                console.log(data);

                fetch('/titles/api/v2/edit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                    })
                    .catch(error => {
                        console.error('Error:', error);
                });
            });
        });

        map.on('draw:deleted', (e) => {
            currentPolygonEvent = e;
        });

        map.on('move', (e) => {
        // This event will trigger when the map is panned or zoomed
        // Your code here
            localStorage.setItem('centerLat', map.getCenter().lat.toString())
            localStorage.setItem('centerLng', map.getCenter().lng.toString())
            localStorage.setItem('zoomLvl', map.getZoom().toString())
        });


    });

    function generateUniqueId() {
      return Date.now().toString();
    }

</script>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/0.4.2/leaflet.draw.css"/>

<div>
    <div id="map">
    </div>
    {#if currentPolygonEvent?.type == 'draw:created'}
    <PopUp on:closePopUp={() => currentPolygonEvent = null}>
        <h1 slot="header">Create Route</h1>
        <div slot="message" style="margin-bottom: 2px">Label:</div>
        <!-- svelte-ignore a11y-autofocus -->
        <input slot="input" autofocus bind:value={currentPolygonEvent.label} on:keypress={(e) => {e.keyCode == 13 ? createPolygon(currentPolygonEvent) : null}}>
        <div slot="buttons">
            <button on:click={() => currentPolygonEvent = null}>
                Cancel
            </button>
            <button class="submit" on:click={() => createPolygon(currentPolygonEvent)}>
                Submit
            </button>
        </div>
    </PopUp>
    {/if}
    {#if currentPolygonEvent?.type == 'draw:deleted'}
    <PopUp on:closePopUp={() => {currentPolygonEvent.layers.eachLayer((layer) => drawnItems.addLayer(layer)); currentPolygonEvent = null}}>
        <h1 slot="header">Delete Route{currentPolygonEvent?.layers?.getLayers()?.length > 1 ? 's' : ''}</h1>
        <div slot="message" style="margin-bottom: 2px">Delete {currentPolygonEvent?.layers?.getLayers()?.length} route{currentPolygonEvent?.layers?.getLayers()?.length > 1 ? 's' : ''}?</div>
        <!-- <input slot="input" bind:value={currentPolygonEvent.label} on:keypress={(e) => {e.keyCode == 13 ? createPolygon(currentPolygonEvent) : null}}> -->
        <div slot="buttons">
            <button on:click={() => {currentPolygonEvent.layers.eachLayer((layer) => drawnItems.addLayer(layer)); currentPolygonEvent = null}}>
                Cancel
            </button>
            <button class="submit" on:click={() => deletePolygon(currentPolygonEvent)}>
                Submit
            </button>
        </div>
    </PopUp>
    {/if}
</div>
  
<style>
    #map {
        height: 100vh;
    }
    button {
        background-color: #fff;
    }
    button:hover {
        background-color: #f4f4f4;
    }
    h1 {
        margin: 5px;
    }
    .submit {
        background-color: cornflowerblue;
        color: white;
    }
    .submit:hover {
        color: black;
    }
</style>
