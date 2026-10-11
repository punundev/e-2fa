import {
  siGoogle,
  siGithub,
  siGitlab,
  siDiscord,
  siApple,
  siX,
  siFacebook,
  siInstagram,
  siSteam,
  siDropbox,
  siReddit,
  siSpotify,
  siNetflix,
  siPaypal,
  siStripe,
  siTelegram,
  siWhatsapp,
  siSignal,
  siProton,
  siProtonmail,
  siBitwarden,
  si1password,
  siLastpass,
  siCloudflare,
  siDigitalocean,
  siVercel,
  siSupabase,
  siDocker,
  siKubernetes,
  siBinance,
  siCoinbase,
  siNotion,
  siFigma,
  siRoblox,
  siEpicgames,
  siShopify,
  siWordpress,
  siMedium,
  siPatreon,
  siKickstarter,
  siEbay,
  siUber,
  siNpm,
  siPypi,
  siMega,
  siTwitch,
  siBitbucket,
  siAtlassian,
  siJira,
  siTrello,
  siSony,
  siPlaystation,
  siBattledotnet,
  siBrave,
  siFirefox,
  siGooglechrome,
  siLinux,
  siUbuntu,
  siDebian,
  siArchlinux,
  siFedora,
  siGoogleauthenticator,
  siAnthropic,
  siClaude,
  siHuggingface,
  siGit,
  SimpleIcon,
} from "simple-icons";

export interface BrandIconData {
  title: string;
  hex: string;
  path: string;
}

const MICROSOFT_ICON: BrandIconData = {
  title: "Microsoft",
  hex: "00A4EF",
  path: "M1 1h10v10H1zm12 0h10v10H13zM1 13h10v10H1zm12 0h10v10H13z",
};

const AMAZON_ICON: BrandIconData = {
  title: "Amazon",
  hex: "FF9900",
  path: "M13.844 14.734c-1.503 1.127-3.666 1.728-5.617 1.728-2.736 0-5.203-1.025-7.071-2.74-.146-.134-.158-.337-.024-.482.134-.146.337-.158.482-.024 1.714 1.572 4.004 2.518 6.536 2.518 1.803 0 3.82-.562 5.257-1.632.221-.166.49.096.347.304-.157.228.09.328.09.328zm.974-1.258c-.184-.239-.607-.113-.895-.035-.091.025-.138-.073-.075-.152.413-.526 1.341-.374 1.487-.197.146.177-.076 1.144-.457 1.533-.059.06-.118.028-.093-.05.08-.25.217-.86.033-1.099zM22.5 10.5c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10 10 4.477 10 10z",
};

function toData(icon: SimpleIcon): BrandIconData {
  return {
    title: icon.title,
    hex: icon.hex,
    path: icon.path,
  };
}

const BRAND_MAP: Record<string, BrandIconData> = {
  google: toData(siGoogle),
  gmail: toData(siGoogle),
  googleauthenticator: toData(siGoogleauthenticator),
  chrome: toData(siGooglechrome),
  github: toData(siGithub),
  gitlab: toData(siGitlab),
  discord: toData(siDiscord),
  microsoft: MICROSOFT_ICON,
  office: MICROSOFT_ICON,
  office365: MICROSOFT_ICON,
  outlook: MICROSOFT_ICON,
  azure: MICROSOFT_ICON,
  xbox: MICROSOFT_ICON,
  amazon: AMAZON_ICON,
  aws: AMAZON_ICON,
  apple: toData(siApple),
  icloud: toData(siApple),
  x: toData(siX),
  twitter: toData(siX),
  facebook: toData(siFacebook),
  meta: toData(siFacebook),
  instagram: toData(siInstagram),
  steam: toData(siSteam),
  dropbox: toData(siDropbox),
  reddit: toData(siReddit),
  spotify: toData(siSpotify),
  netflix: toData(siNetflix),
  paypal: toData(siPaypal),
  stripe: toData(siStripe),
  telegram: toData(siTelegram),
  whatsapp: toData(siWhatsapp),
  signal: toData(siSignal),
  proton: toData(siProton),
  protonmail: toData(siProtonmail),
  bitwarden: toData(siBitwarden),
  "1password": toData(si1password),
  lastpass: toData(siLastpass),
  cloudflare: toData(siCloudflare),
  digitalocean: toData(siDigitalocean),
  vercel: toData(siVercel),
  supabase: toData(siSupabase),
  docker: toData(siDocker),
  kubernetes: toData(siKubernetes),
  binance: toData(siBinance),
  coinbase: toData(siCoinbase),
  notion: toData(siNotion),
  figma: toData(siFigma),
  roblox: toData(siRoblox),
  epic: toData(siEpicgames),
  epicgames: toData(siEpicgames),
  shopify: toData(siShopify),
  wordpress: toData(siWordpress),
  medium: toData(siMedium),
  patreon: toData(siPatreon),
  kickstarter: toData(siKickstarter),
  ebay: toData(siEbay),
  uber: toData(siUber),
  npm: toData(siNpm),
  pypi: toData(siPypi),
  mega: toData(siMega),
  twitch: toData(siTwitch),
  bitbucket: toData(siBitbucket),
  atlassian: toData(siAtlassian),
  jira: toData(siJira),
  trello: toData(siTrello),
  sony: toData(siSony),
  playstation: toData(siPlaystation),
  blizzard: toData(siBattledotnet),
  battlenet: toData(siBattledotnet),
  brave: toData(siBrave),
  firefox: toData(siFirefox),
  linux: toData(siLinux),
  ubuntu: toData(siUbuntu),
  debian: toData(siDebian),
  arch: toData(siArchlinux),
  fedora: toData(siFedora),
  anthropic: toData(siAnthropic),
  claude: toData(siClaude),
  huggingface: toData(siHuggingface),
  git: toData(siGit),
};

export function getBrandIcon(
  issuer?: string,
  accountName?: string,
): BrandIconData | null {
  const clean = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, "");

  const issuerKey = issuer ? clean(issuer) : "";
  const nameKey = accountName ? clean(accountName) : "";

  if (issuerKey && BRAND_MAP[issuerKey]) {
    return BRAND_MAP[issuerKey];
  }

  // Check substring matches in issuer
  for (const [key, icon] of Object.entries(BRAND_MAP)) {
    if (issuerKey && (issuerKey.includes(key) || key.includes(issuerKey))) {
      return icon;
    }
  }

  // Fallback check in accountName (e.g. user@gmail.com)
  if (nameKey) {
    if (nameKey.includes("google") || nameKey.includes("gmail")) {
      return BRAND_MAP.google;
    }
    if (nameKey.includes("github")) {
      return BRAND_MAP.github;
    }
    if (nameKey.includes("discord")) {
      return BRAND_MAP.discord;
    }
    if (nameKey.includes("microsoft") || nameKey.includes("outlook")) {
      return BRAND_MAP.microsoft;
    }
    for (const [key, icon] of Object.entries(BRAND_MAP)) {
      if (nameKey.includes(key)) {
        return icon;
      }
    }
  }

  return null;
}
