export default {
  index: {
    title: 'Home',
    type: 'page',
    display: 'hidden'
  },
  introduction: {
    title: 'Introduction'
  },
  concepts: {
    title: 'Concepts'
  },
  platform: {
    title: 'Platform'
  },
  integration: {
    title: 'Integration'
  },
  operations: {
    title: 'Operations'
  },
  reference: {
    title: 'Reference'
  },
  '--products': {
    type: 'separator',
    title: 'Productos'
  },
  'products-dashboards': {
    title: 'Dashboards',
    href: '/es/products/dashboards'
  },
  'products-geocoding': {
    title: 'Geocodificación',
    href: '/es/products/geocoding'
  },
  products: {
    title: 'Productos',
    type: 'page',
    display: 'hidden'
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
