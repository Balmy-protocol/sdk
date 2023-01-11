module.exports = {
  overrides: [
    {
      files: ['**.ts', '**.js', '**.yml'],
      options: {
        printWidth: 145,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
        useTabs: false,
        endOfLine: 'auto',
      },
    },
    {
      files: '**.json',
      options: {
        tabWidth: 2,
        printWidth: 200,
      },
    },
  ],
};
