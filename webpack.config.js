const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const fs = require('fs');

const manifestJson = JSON.parse(fs.readFileSync('src/manifest.json', 'utf-8'));
const name = manifestJson.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

module.exports = {
  entry: {
    content: './src/js/content.js'
  },
  output: {
    path: path.join(__dirname, '/dist'),
    filename: '[name].js',
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          context: 'src/',
          from: 'manifest.json',
          transform: function (content) {
            // generates the manifest file using the package.json version
            return Buffer.from(
              JSON.stringify({
                ...JSON.parse(content.toString()),
                version: packageJson.version,
              })
            );
          },
        },
        {
          context: 'src/',
          from: 'icons'
        }
      ]
    }),
    new ZipPlugin({
      path: '../releases',
      filename: `${name}-${packageJson.version}.zip`,
    })
  ],
  mode: 'production'
};
