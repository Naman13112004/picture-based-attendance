import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: isDev,
})({
  reactCompiler: true,
  output: "standalone",
});