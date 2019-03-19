const nodeExternals = require('webpack-node-externals')
const path = require('path')
// const Visualizer = require('webpack-visualizer-plugin')
const webpack = require('webpack')

const common = {
  entry: ['./index.js'],
  module: {
    rules: [
      {
        test: /.js$/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}

const node = {
  ...common,
  target: 'node',
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'zaplink.js',
    library: 'zaplink',
    libraryTarget: 'umd'
  },
  plugins: [
    // new Visualizer({ filename: 'build-stats.node.html' })
  ]
}

const web = {
  ...common,
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'zaplink-browser.js',
    library: 'zaplink',
    libraryTarget: 'umd'
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^crypto$/, path.resolve(__dirname, 'lib/empty.js'))
    // new Visualizer({ filename: 'build-stats.html' })
  ]
}

// module.exports = node

module.exports = [ node, web ]
