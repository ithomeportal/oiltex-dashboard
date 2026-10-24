import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Flat config (Next 16 removed `next lint`). Run with `npm run lint`.
const config = [
  ...nextVitals,
  ...nextTs,
  {
    // The app's pages load data with the classic fetch-in-useEffect pattern,
    // which these React-compiler rules flag. Kept visible as warnings rather
    // than rewriting every page; new code should prefer derived state.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "scripts/**", "*.py"] },
];

export default config;
