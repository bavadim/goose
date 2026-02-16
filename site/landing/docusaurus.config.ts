import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const landingGhOwner = process.env.LANDING_GH_OWNER ?? "redsquad-tech";
const landingGhRepo = process.env.LANDING_GH_REPO ?? "is-goose";
const landingContactEmail = process.env.LANDING_CONTACT_EMAIL ?? "bavadim@gmail.com";
const baseUrl = "/is-goose/";

const config: Config = {
  title: "InsightStream",
  tagline: "RPA-агент для повседневной работы на компьютере",
  favicon: "brand/favicon.ico",

  url: process.env.LANDING_SITE_URL ?? `https://${landingGhOwner}.github.io`,
  baseUrl,
  organizationName: landingGhOwner,
  projectName: landingGhRepo,

  onBrokenLinks: "throw",
  onBrokenAnchors: "ignore",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn"
    }
  },
  trailingSlash: false,

  i18n: {
    defaultLocale: "ru",
    locales: ["ru"]
  },

  customFields: {
    landingGhOwner,
    landingGhRepo,
    landingContactEmail
  },

  presets: [
    [
      "classic",
      {
        docs: false,
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies Preset.Options
    ]
  ],
  stylesheets: [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
  ],

  themeConfig: {
    image: "brand/logo_light.png",
    colorMode: {
      defaultMode: "light",
      disableSwitch: true,
      respectPrefersColorScheme: false
    },
    navbar: {
      title: "InsightStream",
      logo: {
        alt: "InsightStream",
        src: "brand/logo_light.png",
        srcDark: "brand/logo_dark.png"
      },
      items: [
        { to: "/#features", label: "Возможности", position: "left" },
        { to: "/#download", label: "Скачать", position: "left" },
        { to: "/#pricing", label: "Тариф", position: "left" },
        { to: "/offer", label: "Оферта", position: "right" }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Контакты",
          items: [
            {
              label: landingContactEmail,
              href: `mailto:${landingContactEmail}`
            }
          ]
        },
        {
          title: "Разработчикам",
          items: [
            {
              label: "Goose (upstream)",
              href: "https://github.com/block/goose"
            }
          ]
        },
        {
          title: "Юридическая информация",
          items: [
            {
              label: "Публичная оферта",
              to: "/offer"
            }
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} ООО Инсайтстрим`
    }
  } satisfies Preset.ThemeConfig
};

export default config;
