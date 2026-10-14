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
      all: { title: 'Todos los productos', href: '/es/products' }
    }
  }
}
