<script setup>

import { ref, onMounted, computed } from 'vue'
import moment from 'moment'
import mapboxgl from 'mapbox-gl'
import { MapboxCustomLayer } from './MapboxCustomLayer'

mapboxgl.accessToken = 'pk.eyJ1IjoiYmpvaGFyZSIsImEiOiI1S3VKQ3NFIn0.TPJtCWtEGXg45rUz766_2Q';

let map = ref();
const zoom = ref(16);
const center = ref([-60.305, -7.250]);
const startDate = '2021-08-19'
const endDate = '2023-08-19'
const min = ref(2350); //
const max = ref(3153);
const filter = ref(3158);
const gladLayer = ref();

const backgroundLayer = {
    id: 'background',
    type: 'background',
    paint: {
        'background-color': 'white'
    }

}

const gladSource = {
    type: 'raster',
    tiles: ['https://tiles.globalforestwatch.org/gfw_integrated_alerts/latest/default/{z}/{x}/{y}.png'],
    tileSize: 256
}

const customLayer = {
    id: 'gfw_integrated_alerts',
    source: 'gfw_integrated_alerts',
    options: {
        startDateIndex: min.value,
        endDateIndex: max.value,
    }
}


const onSliderChange = (e) => {
    filter.value = parseInt(e.srcElement.value);
    gladLayer.value.filter(min.value, filter.value);
    map.triggerRepaint();
}

const filterDate = computed(() => {
    const d = moment('2014-12-31')
    return d.add(filter.value, 'd').format('YYYY-MM-DD')
});


onMounted(() => {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v10',
        center: center.value,
        zoom: zoom.value,
        renderWorldCopies: false,
        hash: false,
    });

    map.on('load', () => {
        // map.addLayer(backgroundLayer)
        map.addSource('gfw_integrated_alerts', gladSource)
        gladLayer.value = new MapboxCustomLayer(customLayer)
        map.addLayer(gladLayer.value)
    })
})
</script>
<template>
    <div id="container">
        <div id="map"></div>
        <div id="controls">
            <h3>GLAD Integrated Alerts using Mapbox Custom Layer</h3>
            <div>
                <a target="_blank" href="https://www.globalforestwatch.org/map/?map=eyJjZW50ZXIiOnsibGF0IjotNy4yNTA2MDM2NDEwMDcxNzEsImxuZyI6LTYwLjMwMTExNTkxMTk5NjYyNX0sInpvb20iOjE1Ljg3MDI3MjUzNjU5OTQ5NSwiZGF0YXNldHMiOlt7ImRhdGFzZXQiOiJpbnRlZ3JhdGVkLWRlZm9yZXN0YXRpb24tYWxlcnRzLThiaXQiLCJvcGFjaXR5IjoxLCJ2aXNpYmlsaXR5Ijp0cnVlLCJsYXllcnMiOlsiaW50ZWdyYXRlZC1kZWZvcmVzdGF0aW9uLWFsZXJ0cy04Yml0Il0sInRpbWVsaW5lUGFyYW1zIjp7InN0YXJ0RGF0ZSI6IjIwMjEtMDgtMjMiLCJlbmREYXRlIjoiMjAyMy0wOC0yMyIsInRyaW1FbmREYXRlIjoiMjAyMy0wOC0yMyJ9fSx7ImRhdGFzZXQiOiJwb2xpdGljYWwtYm91bmRhcmllcyIsImxheWVycyI6WyJkaXNwdXRlZC1wb2xpdGljYWwtYm91bmRhcmllcyIsInBvbGl0aWNhbC1ib3VuZGFyaWVzIl0sIm9wYWNpdHkiOjEsInZpc2liaWxpdHkiOnRydWV9XX0%3D">
                    Compare with same location in GFW
                </a>
            </div>
            <div class="slider-control">
                <div>Filter by Date</div>
                <input @input="onSliderChange" v-model="filter" type="range" :min="min" :max="max" class="slider"/>
                <div>{{ filterDate }}</div>
            </div>
        </div>
    </div>
</template>

<style lang="css">
@import "mapbox-gl/dist/mapbox-gl.css";
#container {
    display: flex;
    padding: 0;
    font-family: sans-serif;
}

#map {
  height: 100vh;
  width: 80%;
}

#controls {
    width: 20%;
    padding: 1rem;
}

#controls a {
    text-decoration: none;
}
.slider-control {
    margin-top: 2rem;
    width: 100%;
}
.slider {
    width: 80%;
}

</style>