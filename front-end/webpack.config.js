const { Configuration } = require('webpack');
const path = require('path');
const fs = require('fs');
const evalSourceMapMiddleware = require('react-dev-utils/evalSourceMapMiddleware');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');

// Define paths object
const paths = {
  proxySetup: path.resolve(__dirname, 'src/setupProxy.js'),
  publicUrlOrPath: '/'
};

/**
 * @type {Configuration}
 */
module.exports = {
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined')
      }

      if (fs.existsSync(paths.proxySetup)) {
        require(paths.proxySetup)(devServer.app)
      }

      middlewares.push(
        evalSourceMapMiddleware(devServer),
        redirectServedPath(paths.publicUrlOrPath),
        noopServiceWorkerMiddleware(paths.publicUrlOrPath)
      )

      return middlewares;
    }
  }
}; 