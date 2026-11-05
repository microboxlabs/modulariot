export default {
  index: {
    title: 'Productos',
    display: 'hidden'
  },
  dashboards: 'Dashboards',
  geocoding: 'Geocodificación',
  platform: {
    title: 'Documentación de la plataforma',
    type: 'page',
    href: '/es/introduction'
  },
  menu: {
    title: 'Productos',
    type: 'menu',
    items: {
      dashboards: { title: 'Dashboards', href: '/es/products/dashboards' },
      geocoding: { title: 'Geocodificación', href: '/es/products/geocoding' },
      all: { title: 'Todos los productos', href: '/es/products' }
    }
  }
}
