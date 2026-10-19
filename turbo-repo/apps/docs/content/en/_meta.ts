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
    title: 'Products'
  },
  'products-dashboards': {
    title: 'Dashboards',
    href: '/en/products/dashboards'
  },
  products: {
    title: 'Products',
    type: 'page',
    display: 'hidden'
  },
  menu: {
    title: 'Products',
    type: 'menu',
    items: {
      dashboards: { title: 'Dashboards', href: '/en/products/dashboards' },
      all: { title: 'All products', href: '/en/products' }
    }
  }
}
