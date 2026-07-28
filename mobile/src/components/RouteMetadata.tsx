import Head from "expo-router/head";
import { usePathname } from "expo-router";
import { titleForPathname } from "../navigation/routes";

export function RouteMetadata() {
  const pathname = usePathname();

  return (
    <Head>
      <title>{titleForPathname(pathname)}</title>
    </Head>
  );
}
