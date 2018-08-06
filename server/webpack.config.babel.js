import { resolve } from 'path'
import webpack from 'webpack'
import UglifyJsPlugin from 'uglifyjs-webpack-plugin'
import ExtractCssChunks from 'extract-css-chunks-webpack-plugin'
import WriteFilePlugin from 'write-file-webpack-plugin' // here so you can see what chunks are built
import StatsPlugin from 'stats-webpack-plugin'
import nodeExternals from 'webpack-node-externals'

const res = p => resolve(__dirname, p)

export default env => {
  const isServer = JSON.parse(env.server) || undefined
  const isClient = !isServer || undefined
  const isDev = process.env.NODE_ENV === 'development' || undefined
  const isProd = !isDev || undefined
  return {
    name: isServer ? 'server' : 'client',
    target: isServer ? 'node' : 'web',
    mode: process.env.NODE_ENV,
    devtool: 'source-map',
    entry: {
      [isServer ? 'h' : 'main']: [
        isServer && 'source-map-support/register',
        isClient &&
          isDev &&
          'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000&reload=false&quiet=false&noInfo=false',
        isClient && 'babel-polyfill',
        res(isServer ? '../src/render.server.js' : '../src/render.browser.js')
      ].filter(Boolean)
    },
    externals: isServer && [
      nodeExternals({
        // if you're specifying externals to leave unbundled, you need to tell Webpack
        // to still bundle these modules so that they know they are running
        // within Webpack and can properly make connections to client modules:
        whitelist: [
          /react-dom\/server/,
          /react-universal-component/,
          /webpack-flush-chunks/,
          /redux-devtools-extension/,
          /react-hot-loader/,
          /babel-plugin-universal-import\/universalImport/
        ]
      })
    ],
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',
      path: res(isServer ? '../buildServer' : '../buildClient'),
      publicPath: '/static/',
      libraryTarget: isServer && 'commonjs2'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              // { modules: false } allows tree shaking, HMR, and import errors/warnings to work correctly
              // Sadly, node doesn't support ES imports/exports yet, so it can't go in .babelrc
              babelrc: false,
              cacheDirectory: true,
              presets: [['env', { modules: false }], 'react'],
              plugins: [
                'react-hot-loader/babel',
                'syntax-dynamic-import',
                'universal-import',
                'transform-flow-strip-types',
                'syntax-object-rest-spread',
                'transform-class-properties'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          exclude: /node_modules/,
          use: [
            isClient && ExtractCssChunks.loader,
            {
              loader: isServer ? 'css-loader/locals' : 'css-loader',
              options: {
                modules: true,
                localIdentName: '[name]__[local]--[hash:base64:5]'
              }
            }
          ].filter(Boolean)
        }
      ]
    },
    resolve: {
      extensions: isServer
        ? ['.server.js', '.js', '.css']
        : ['.browser.js', '.js', '.css']
    },
    optimization: {
      minimizer: [
        new UglifyJsPlugin({
          minify: (file, sourceMap) => {
            const terserOptions = {
              compress: false,
              sourceMap: sourceMap && {
                content: sourceMap
              },
              ie8: true
            }

            // eslint-disable-next-line global-require
            return require('terser').minify(file, terserOptions)
          },
          sourceMap: true
        })
      ],
      runtimeChunk: isClient && {
        name: 'bootstrap'
      },
      splitChunks: isClient && {
        chunks: 'initial',
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor'
          }
        }
      }
    },
    plugins: [
      isClient && new ExtractCssChunks(),
      isServer &&
        new webpack.optimize.LimitChunkCountPlugin({
          maxChunks: 1
        }),
      isClient && isDev && new webpack.HotModuleReplacementPlugin(),
      isClient && isProd && new StatsPlugin('stats.json'),
      isClient && isProd && new webpack.HashedModuleIdsPlugin(), // not needed for strategy to work (just good practice)
      new WriteFilePlugin()
    ].filter(Boolean)
  }
}
