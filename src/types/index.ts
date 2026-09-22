export type BlockType = 
  | 'profile'
  | 'text'
  | 'link'
  | 'whatsapp'
  | 'phone'
  | 'email'
  | 'social'
  | 'location'
  | 'catalog'
  | 'product'
  | 'service'
  | 'pix'
  | 'wifi'
  | 'qrcode'
  | 'image'
  | 'video'
  | 'button';

export type BioSiteStatus = 'draft' | 'published' | 'disabled' | 'archived';

export type CatalogLayout = 'cards' | 'grid' | 'list' | 'carousel';

export type ButtonStyle = 'filled' | 'outline' | 'soft' | 'gradient' | 'shadow';
export interface ButtonAppearance {
  style?: ButtonStyle;
  backgroundType?: 'transparent' | 'solid';
  color?: string;
  gradient?: string;
  textColor?: string;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  borderWidth?: 'none' | 'thin' | 'medium' | 'thick';
  shadow?: 'none' | 'subtle' | 'medium' | 'strong' | 'glow';
  fontFamily?: string;
  fontSize?: 'sm' | 'base' | 'lg';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
}

export type CardStyle = 'flat' | 'elevated' | 'bordered' | 'glass' | 'solid' | 'glow' | 'minimal';

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type ClientAccessLevel = 'full' | 'operational' | 'readonly';
export type ClientPermission = ClientAccessLevel;
export type ClientAccessMode = 'management' | 'view';

export interface LeadCaptureSettings {
  enabled: boolean;
  title: string;
  description?: string;
  buttonText: string;
  fields: ('name' | 'email' | 'phone')[];
  showOnEntry: boolean;
}

export interface GoogleReviewSettings {
  enabled: boolean;
  url: string;
  title?: string;
  buttonText?: string;
}

export interface BookingRecord {
  id: string;
  serviceId?: string;
  serviceName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerWhatsapp: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

export interface LeadRecord {
  id: string;
  name: string;
  whatsapp: string;
  lastService?: string;
  lastBookingAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'expired' | 'past_due' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'superadmin' | 'user' | 'team' | 'client';
  planId?: string;
  createdAt: string;
  status?: 'active' | 'suspended';
  company?: string;
  clientAccessLevel?: ClientAccessLevel;
  language?: 'pt-BR' | 'en-US' | 'en-GB' | 'pt-PT' | 'es-ES';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  planId: string;
  isAgency: boolean;
  whiteLabel?: {
    enabled: boolean;
    brandName: string;
    logoUrl?: string;
    primaryColor?: string;
    hideNaBioBadge?: boolean;
    supportEmail?: string;
  };
  createdAt: string;
}

export interface TeamMember {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface SocialLink {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'pinterest' | 'telegram' | 'threads' | 'whatsapp' | 'custom';
  name: string;
  url: string;
  order: number;
  active: boolean;
  iconName?: string;
  iconColor?: string;
  iconSize?: number;
  titlePosition?: 'inside' | 'above' | 'hidden';
  titleColor?: string;
  titleFontFamily?: string;
  titleFontSize?: number;
  buttonColor?: string;
  buttonSize?: 'sm' | 'md' | 'lg';
}

export interface CustomLink {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  icon?: string;
  imageUrl?: string;
  bgColor?: string;
  backgroundType?: 'transparent' | 'solid';
  backgroundGradient?: string;
  textColor?: string;
  style?: ButtonStyle;
  highlight?: boolean;
  badge?: string;
  order: number;
  active: boolean;
  clicks: number;
  iconName?: string;
  iconColor?: string;
  iconSize?: number;
  showIcon?: boolean;
  titlePosition?: 'inside' | 'above';
  titleColor?: string;
  titleFontFamily?: string;
  titleFontSize?: number;
  buttonHeight?: 'sm' | 'md' | 'lg';
  buttonBorderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  buttonBorderWidth?: 'none' | 'thin' | 'medium' | 'thick';
  buttonShadow?: 'none' | 'subtle' | 'medium' | 'strong' | 'glow';
  titleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
}

export interface ProductCategory {
  id: string;
  name: string;
  order: number;
  active: boolean;
}

export interface ProductItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl?: string;
  images?: string[]; // Up to 10 photos
  videoUrl?: string; // Short video up to 15s
  videoDuration?: number; // Video duration (max 15s)
  badge?: string; // e.g. "PROMOÇÃO", "NOVIDADE", "DESTAQUE"
  badgeColor?: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
  order: number;
  ctaText: string;
  ctaAction: 'whatsapp' | 'link' | 'schedule' | 'buy';
  ctaUrl?: string;
  views: number;
  clicks: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  promotionalPrice?: number;
  description: string;
  imageUrl?: string;
  images?: string[]; // Up to 10 photos
  videoUrl?: string; // Short video up to 15s
  videoDuration?: number;
  badge?: string; // e.g. "PROMOÇÃO", "NOVIDADE", "EXCLUSIVO"
  badgeColor?: string;
  active: boolean;
}

export interface PixSettings {
  enabled: boolean;
  keyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pixKey: string;
  receiverName: string;
  city: string;
  suggestedAmounts: number[];
  description?: string;
}

export interface WifiSettings {
  enabled: boolean;
  ssid: string;
  password: string;
  securityType: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface LocationSettings {
  enabled: boolean;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  complement?: string;
  mapsUrl?: string;
}

export interface BioSiteTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  backgroundType: 'solid' | 'gradient' | 'image' | 'video';
  backgroundGradient?: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  backgroundOverlayOpacity?: number; // 0 to 100
  backgroundBlur?: number; // 0 to 20
  textColor: string;
  subtextColor?: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonOverrides?: {
    whatsapp?: ButtonAppearance;
    phone?: ButtonAppearance;
    email?: ButtonAppearance;
    google?: ButtonAppearance;
    pix?: ButtonAppearance;
    booking?: ButtonAppearance;
    location?: ButtonAppearance;
  };
  buttonOverrideOrder?: ('whatsapp' | 'phone' | 'email' | 'google' | 'pix' | 'booking' | 'location')[];
  buttonBackgroundType?: 'solid' | 'gradient';
  buttonGradient?: string;
  locationButtonBackgroundType?: 'solid' | 'gradient';
  locationButtonColor?: string;
  locationButtonGradient?: string;
  locationButtonText?: string;
  locationButtonTextColor?: string;
  buttonStyle: ButtonStyle;
  buttonOpacity?: number;
  buttonBorderWidth?: 'none' | 'thin' | 'medium' | 'thick';
  buttonShadow?: 'none' | 'subtle' | 'medium' | 'strong' | 'glow';
  buttonPadding?: 'compact' | 'comfortable' | 'spacious';
  buttonFontFamily?: string;
  buttonFontSize?: 'sm' | 'base' | 'lg';
  buttonFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  buttonBorderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  cardStyle: CardStyle;
  cardBorderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  cardBorderWidth?: 'none' | 'thin' | 'medium' | 'thick';
  cardShadow?: 'none' | 'subtle' | 'medium' | 'dramatic' | 'glow';
  cardOpacity?: number; // 10 to 100
  fontFamily: 'Montserrat' | 'Poppins' | 'Plus Jakarta Sans' | 'Outfit' | 'Inter' | 'DM Sans' | 'Syne' | 'Playfair Display' | 'Space Grotesk' | 'Cinzel' | 'Cormorant Garamond' | 'Oswald' | 'Roboto' | 'Raleway' | string;
  headingFontFamily?: string;
  headingWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  bodyWeight?: 'normal' | 'medium' | 'semibold';
  headingTransform?: 'none' | 'uppercase' | 'capitalize';
  letterSpacing?: 'tighter' | 'tight' | 'normal' | 'wide' | 'widest';
  fontSize?: 'sm' | 'base' | 'lg';
  catalogLayout?: CatalogLayout;
  carouselMode?: 'manual' | 'auto';
  carouselIntervalSeconds?: number;
  buttonStackMode?: 'wrap' | 'stacked';
  categoryLayoutMode?: 'wrap' | 'scroll';
  showCoverImage: boolean;
  coverImageUrl?: string;
  profileBadgeEmoji?: string;
  profileBadgeColor?: string;
}

export type ThemeConfig = BioSiteTheme;

export interface BioSiteBlock {
  id: string;
  type: BlockType;
  title?: string;
  order: number;
  active: boolean;
  data?: Record<string, any>;
}

export interface BioSite {
  id: string;
  organizationId: string;
  slug: string;
  status: BioSiteStatus;
  templateId?: string;
  businessType: string;
  
  // Basic info
  name: string;
  commercialName: string;
  profession?: string;
  category: string;
  bio: string;
  avatarUrl: string;
  logoUrl?: string;
  coverImageUrl?: string;
  introVideoUrl?: string; // Short video presentation up to 15s (Stories style)
  
  // Contact
  phone?: string;
  whatsapp?: string;
  whatsappMessage?: string;
  whatsappButtonText?: string;
  email?: string;
  
  // Detailed modules
  socialLinks: SocialLink[];
  links: CustomLink[];
  categories: ProductCategory[];
  products: ProductItem[];
  services: ServiceItem[];
  pix: PixSettings;
  wifi: WifiSettings;
  location: LocationSettings;
  theme: BioSiteTheme;
  blocks: BioSiteBlock[];
  
  // Service scheduling
  bookingSettings?: {
    enabled: boolean;
    slotDurationMinutes: number;
    slotIntervalMinutes?: number;
    notifyEmail?: string;
    sendEmailNotification?: boolean;
    ownerWhatsapp?: string;
    workingDays?: number[];
    availableTimes?: string[];
  };
  bookings?: BookingRecord[];
  leads?: LeadRecord[];
  leadCapture?: LeadCaptureSettings;
  googleReview?: GoogleReviewSettings;

  // Tracking & Integrations
  metaPixelId?: string;
  googleAnalyticsId?: string;
  customPixels?: {
    metaPixelId?: string;
    facebookPixelId?: string;
    googleAnalyticsId?: string;
    tiktokPixelId?: string;
    googleTagManagerId?: string;
    customHeadCode?: string;
  };

  // Agency & White Label
  whiteLabel?: boolean | {
    enabled: boolean;
    hideBranding?: boolean;
    customFooterText?: string;
    customLogoUrl?: string;
  };
  agencyBranding?: {
    enabled: boolean;
    text?: string;
    url?: string;
    logoUrl?: string;
    agencyName?: string;
    agencyUrl?: string;
  };

  // Custom Domain & SEO
  customDomain?: string;
  customDomainStatus?: 'pending' | 'verified' | 'failed';
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  
  // Security & Client Access
  editKey: string;
  clientEditKey?: string;
  clientAccessLevel: ClientAccessLevel;
  clientPermission?: ClientAccessLevel;
  clientAccessMode?: ClientAccessMode;
  clientAccessEmail?: string;
  clientAccessPassword?: string;
  
  // Metadata
  views: number;
  uniqueVisitors: number;
  totalClicks: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEvent {
  id: string;
  bioSiteId: string;
  type: 'view' | 'page_view' | 'link_click' | 'whatsapp_click' | 'phone_click' | 'email_click' | 'pix_copy' | 'wifi_scan' | 'wifi_connect' | 'product_click' | 'product_view' | 'location_click' | 'vcard_download' | 'share_click' | 'share' | 'schedule_click' | 'lead_capture';
  targetId?: string;
  targetLabel?: string;
  device: 'mobile' | 'desktop' | 'tablet';
  referrer?: string;
  timestamp: string;
}

export interface PlanFeature {
  maxBioSites: number;
  maxProducts: number;
  hasCatalog: boolean;
  hasPix: boolean;
  hasWifi: boolean;
  hasAnalytics: boolean;
  hasAdvancedTheme: boolean;
  hasCustomDomain: boolean;
  hasWhiteLabel: boolean;
  hasTeam: boolean;
  maxTeamMembers: number;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  popular?: boolean;
  features: PlanFeature;
  featuresList: string[];
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  previewThumbnail: string;
  defaultData: Partial<BioSite>;
}
