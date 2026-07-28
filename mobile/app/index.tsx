import { Redirect } from "expo-router";
import { GROUP_HREFS } from "../src/navigation/routes";

export default function IndexRoute() {
  return <Redirect href={GROUP_HREFS.tabs} />;
}
