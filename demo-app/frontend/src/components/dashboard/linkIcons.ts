import { Globe, ExternalLink, Landmark, Mail, FileText, Link2 } from "lucide-react";

export const LINK_ICONS = {
  globe: Globe,
  external: ExternalLink,
  institution: Landmark,
  mail: Mail,
  document: FileText,
  link: Link2,
} as const;

export type LinkIconKey = keyof typeof LINK_ICONS;
