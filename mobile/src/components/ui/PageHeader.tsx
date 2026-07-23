import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SectionHeader } from "./SectionHeader";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PageHeader(props: PageHeaderProps) {
  return <SectionHeader {...props} variant="page" />;
}
