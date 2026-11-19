import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'mt5-bridge/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
