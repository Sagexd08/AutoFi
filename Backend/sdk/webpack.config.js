const path = require('path');

module.exports = {
  entry: {
    index: './src/index.ts',
    modules: './src/modules/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    library: {
      name: (entryData) => {
        // Generate unique library name based on entry point
        const entryName = entryData.chunk.name;
        const capitalizedName = entryName.charAt(0).toUpperCase() + entryName.slice(1);
        return `CeloAISDK${capitalizedName}`;
      },
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.json',
            transpileOnly: false, // Enable type checking during build
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    'viem': 'viem',
  },
  optimization: {
    minimize: true,
  },
  mode: 'production',
  devtool: 'source-map',
};

