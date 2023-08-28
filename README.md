# GFW Glad Integrated Alerts

We're attempting to us a [Mapbox Custom Layer](https://docs.mapbox.com/mapbox-gl-js/api/properties/#customlayerinterface) to render GFW Glad Integrated alerts. The tiles for this layer are availalable at:

`http://tiles.globalforestwatch.org/gfw_integrated_alerts/latest/default/{z}/{x}/{y}.png)`

Our aim is to be able to filter by date and confidence value. The demo shows that we can render the confidence values accurately, however we're having problems filtering by date.

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```
