var webpack = require('webpack');
var path = require('path');
var proxy = require('http-proxy-middleware');

// Webpack Config
var webpackConfig = {
    entry: {
        'polyfills': './src/polyfills.browser.ts',
        'vendor': './src/vendor.browser.ts',
        'main': './src/main.browser.ts',
    },

    output: {
        path: './dist'
    },

    plugins: [
        new webpack.optimize.OccurenceOrderPlugin(true),
        new webpack.optimize.CommonsChunkPlugin({
            name: ['main', 'vendor', 'polyfills'],
            minChunks: Infinity
        }),
    ],

    module: {
        loaders: [
            // .ts files for TypeScript
            {
                test: /\.ts$/,
                loaders: ['awesome-typescript-loader', 'angular2-template-loader']
            }, {
                test: /\.css$/,
                loaders: ['to-string-loader', 'css-loader']
            }, {
                test: /\.html$/,
                loader: 'raw-loader'
            }, {
              test: /\.scss$/,
              exclude: /node_modules/,
              loaders: ['raw-loader', 'sass-loader'] // sass-loader not scss-loader
            }
        ]
    }
};

// Our Webpack Defaults
var defaultConfig = {
    devtool: 'cheap-module-source-map',
    cache: true,
    debug: true,
    output: {
        filename: '[name].bundle.js',
        sourceMapFilename: '[name].map',
        chunkFilename: '[id].chunk.js'
    },

    resolve: {
        root: [path.join(__dirname, 'dev')],
        extensions: ['', '.ts', '.js', '.scss']
    },

    devServer: {
        quiet: false,
        stats: {
            colors: true
        },
        historyApiFallback: true,
        watchOptions: {
            aggregateTimeout: 300,
            poll: 1000
        },
        proxy: {
            '/api/*': {
                target: 'http://localhost:4001',
                secure: false
            }
        }
    },

    node: {
        global: 1,
        crypto: 'empty',
        module: 0,
        Buffer: 0,
        clearImmediate: 0,
        setImmediate: 0
    }
};

var webpackMerge = require('webpack-merge');
module.exports = webpackMerge(defaultConfig, webpackConfig);
