import type {
  ATSIssue,
  ATSRecommendation,
  ATSScoreResponse,
  ATSSectionReview,
} from "./ats-types.ts"
import type { DocumentArtifacts } from "./document-artifacts.ts"
import { getCurrentUtcDateParts } from "./current-date"

const { currentMonth: CURRENT_MONTH_INDEX, currentYear: CURRENT_YEAR } = getCurrentUtcDateParts()

const SECTION_ALIASES = {
  professionalSummary: [
    "professional summary",
    "summary",
    "profile",
    "career summary",
    "executive summary",
    "summary of qualifications",
    "professional profile",
    "about",
    "overview",
  ],
  workExperience: [
    "work experience",
    "professional experience",
    "experience",
    "employment history",
    "career history",
    "relevant experience",
  ],
  skills: [
    "skills",
    "technical skills",
    "core competencies",
    "technical proficiencies",
    "competencies",
    "expertise",
    "skills & tools",
    "tools & technologies",
    "technical stack",
  ],
  education: [
    "education",
    "academic background",
    "academics",
    "education & training",
  ],
  certifications: [
    "certifications",
    "licenses",
    "licences",
    "certificates",
    "licenses & certifications",
    "professional certifications",
  ],
  projects: [
    "projects",
    "selected projects",
    "project experience",
    "key projects",
    "project highlights",
    "relevant projects",
  ],
  achievements: [
    "achievements",
    "accomplishments",
    "key achievements",
    "awards",
    "honors",
  ],
  volunteerExperience: [
    "volunteer experience",
    "volunteering",
    "community involvement",
    "leadership & service",
  ],
  publications: [
    "publications",
    "research",
    "research experience",
    "papers",
    "patents",
  ],
  additionalInformation: [
    "additional information",
    "additional details",
    "additional experience",
    "other information",
  ],
} as const

type SectionKey = keyof typeof SECTION_ALIASES

const REQUIRED_SECTION_KEYS = [
  "professionalSummary",
  "workExperience",
  "education",
  "skills",
] as const satisfies readonly SectionKey[]

type CanonicalTermCategory =
  | "title"
  | "language"
  | "framework"
  | "cloud"
  | "devops"
  | "data"
  | "analytics"
  | "ai"
  | "security"
  | "testing"
  | "methodology"
  | "product"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "customer"
  | "business"
  | "soft-skill"
  | "compliance"
  | "certification"

interface KeywordVariantGroup {
  canonical: string
  category: CanonicalTermCategory
  variants: string[]
}

interface RoleFamilyDefinition {
  id: string
  titles: string[]
  keywords: string[]
}

interface ContactInfo {
  email: boolean
  phone: boolean
  location: boolean
  url: boolean
  linkedin: boolean
  github: boolean
  professionalEmail: boolean
}

interface SectionBlock {
  key: SectionKey
  title: string
  content: string
  lines: string[]
}

interface JDAnalysis {
  title: string | null
  titleTerms: string[]
  requiredTerms: string[]
  preferredTerms: string[]
  cultureTerms: string[]
  responsibilityTerms: string[]
  domainTerms: string[]
  roleFamilies: string[]
  seniorityTerms: string[]
  yearsRequired: number | null
  degreeRequirement: string | null
  requiredCertifications: string[]
  requiresManagement: boolean
  remoteTerms: string[]
  optionalSections: SectionKey[]
}

interface DateInfo {
  formats: string[]
  consistent: boolean
  futureDates: string[]
  yearsEstimated: number | null
  datedRoleCount: number
}

interface BulletStats {
  total: number
  quantified: number
  strongVerb: number
  weakVerb: number
  averageWordCount: number
  tooShort: number
  tooLong: number
  starLike: number
  timeframeMentioned: number
  technicalSpecificity: number
  repeatedLeadVerbs: string[]
  consistentMarkers: boolean
  passiveVoice: number
  firstPerson: number
  businessImpact: number
  scopeMentioned: number
  toolMentioned: number
  duplicateBullets: number
}

interface SummaryStats {
  lineCount: number
  wordCount: number
  hasYears: boolean
  hasMetric: boolean
  hasRoleTitle: boolean
  first50KeywordMatches: number
  hasSeniority: boolean
  hasObjectiveLanguage: boolean
  firstPerson: boolean
  hasCoreSkills: boolean
  matchedCriticalTerms: number
}

interface RepetitionStats {
  repeatedContentWords: string[]
  repeatedPhrases: string[]
  duplicateBulletFragments: string[]
}

interface SkillsAnalysis {
  items: string[]
  categoryLabels: string[]
  canonicalTerms: string[]
  specificTerms: number
  genericTerms: number
}

interface ResumeLexicalCoverage {
  roleFamilies: string[]
  allCanonicalTerms: string[]
  hardSkills: string[]
  softSkills: string[]
  certifications: string[]
  leadershipSignals: string[]
  businessSignals: string[]
  sectionTermCoverage: Partial<Record<SectionKey | "fullResume", string[]>>
}

interface KeywordAnalysis extends NonNullable<ATSScoreResponse["keywordAnalysis"]> {
  coverageBySection: {
    professionalSummary: string[]
    skills: string[]
    workExperience: string[]
    education: string[]
    projects: string[]
    certifications: string[]
  }
  criticalMatchedTerms: string[]
  criticalMissingTerms: string[]
}

interface QualificationAlignment {
  score: number
  yearsRequired: number | null
  yearsEstimated: number | null
  meetsYearsRequirement: boolean | null
  degreeRequirement: string | null
  meetsDegreeRequirement: boolean | null
  requiredCertifications: string[]
  missingCertifications: string[]
  expectedSeniority: string | null
  observedSeniority: string | null
  seniorityAligned: boolean | null
  managementRequired: boolean
  managementObserved: boolean
  matchedRoleFamilies: string[]
}

interface DocumentStructureSignals {
  detectedSections: SectionKey[]
  contactInHeaderFooter: boolean
  hasTableEvidence: boolean
  hasMultiColumnEvidence: boolean
  readingOrderRisk: number
}

interface DeterministicEvidence {
  requiredSectionsPresent: string[]
  missingSections: string[]
  missingOptionalSections: string[]
  contact: ContactInfo
  dates: DateInfo
  bullets: BulletStats
  summary: SummaryStats
  repetition: RepetitionStats
  jd: JDAnalysis | null
  lexicalCoverage: ResumeLexicalCoverage
  qualification: {
    yearsRequired: number | null
    yearsEstimated: number | null
    meetsYearsRequirement: boolean | null
    degreeRequirement: string | null
    meetsDegreeRequirement: boolean | null
    requiredCertifications: string[]
    missingCertifications: string[]
    expectedSeniority: string | null
    observedSeniority: string | null
    seniorityAligned: boolean | null
    managementRequired: boolean
    managementObserved: boolean
    matchedRoleFamilies: string[]
  }
}

export interface DeterministicATSResult extends ATSScoreResponse {
  evidence: DeterministicEvidence
}

function term(canonical: string, category: CanonicalTermCategory, variants: string[]): KeywordVariantGroup {
  return { canonical, category, variants }
}

const STRONG_VERBS = new Set([
  "accelerated",
  "achieved",
  "adapted",
  "addressed",
  "analyzed",
  "architected",
  "assessed",
  "attained",
  "audited",
  "authored",
  "automated",
  "built",
  "championed",
  "clarified",
  "coached",
  "collaborated",
  "completed",
  "conceived",
  "conducted",
  "consolidated",
  "coordinated",
  "created",
  "customized",
  "decreased",
  "defined",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "diagnosed",
  "directed",
  "discovered",
  "doubled",
  "drove",
  "effected",
  "eliminated",
  "enabled",
  "engineered",
  "enhanced",
  "established",
  "evaluated",
  "executed",
  "expanded",
  "expedited",
  "facilitated",
  "forecasted",
  "founded",
  "generated",
  "guided",
  "identified",
  "implemented",
  "improved",
  "increased",
  "influenced",
  "initiated",
  "innovated",
  "instituted",
  "integrated",
  "interpreted",
  "introduced",
  "investigated",
  "launched",
  "led",
  "managed",
  "mastered",
  "maximized",
  "mentored",
  "minimized",
  "modeled",
  "modernized",
  "negotiated",
  "optimized",
  "orchestrated",
  "organized",
  "originated",
  "oversaw",
  "partnered",
  "pioneered",
  "planned",
  "prioritized",
  "produced",
  "programmed",
  "promoted",
  "proposed",
  "provided",
  "reconciled",
  "redesigned",
  "reduced",
  "refined",
  "reorganized",
  "researched",
  "resolved",
  "restructured",
  "revamped",
  "revitalised",
  "revitalized",
  "saved",
  "scaled",
  "scheduled",
  "simplified",
  "solved",
  "spearheaded",
  "streamlined",
  "strengthened",
  "structured",
  "supervised",
  "surveyed",
  "systematized",
  "tabulated",
  "taught",
  "tested",
  "trained",
  "transformed",
  "translated",
  "tripled",
  "troubleshot",
  "uncovered",
  "unified",
  "upgraded",
  "validated",
  "verified",
])

const WEAK_VERBS = new Set([
  "assisted",
  "contributed",
  "exposed",
  "familiar",
  "familiarized",
  "helped",
  "involved",
  "participated",
  "responsible",
  "supported",
  "tasked",
  "used",
  "utilized",
  "worked",
])

const CULTURE_TERMS = [
  "adaptability",
  "attention to detail",
  "bias for action",
  "collaboration",
  "collaborative",
  "continuous improvement",
  "cross-functional",
  "customer centric",
  "customer obsession",
  "data driven",
  "empathy",
  "execution",
  "growth mindset",
  "high ownership",
  "high-performing",
  "impact",
  "inclusive",
  "innovation",
  "learning agility",
  "operational excellence",
  "optimization",
  "ownership",
  "problem solving",
  "quality",
  "resilience",
  "results oriented",
  "scale",
  "scalable",
  "stakeholder management",
  "strategic thinking",
  "teamwork",
  "user centric",
  "user focused",
]

const CERTIFICATION_TERMS = [
  "aws certified",
  "azure",
  "gcp",
  "google cloud",
  "pmp",
  "scrum master",
  "csm",
  "psm",
  "cissp",
  "security+",
  "cka",
  "ckad",
  "ccna",
  "ccnp",
  "salesforce certified",
  "itil",
  "six sigma",
  "frca",
  "cfa",
  "frm",
  "saFe",
  "comptia",
]

const DEGREE_TERMS = [
  "doctorate",
  "phd",
  "doctoral",
  "master",
  "m.s",
  "ms",
  "mba",
  "m.eng",
  "m.eng.",
  "bachelor",
  "b.s",
  "bs",
  "b.a",
  "ba",
  "b.eng",
  "associate",
  "a.s",
  "a.a",
]

const GENERIC_SKILL_TERMS = new Set([
  "analysis",
  "analytics",
  "business",
  "collaboration",
  "communication",
  "computer skills",
  "customer service",
  "data",
  "development",
  "documentation",
  "engineering",
  "leadership",
  "management",
  "microsoft office",
  "operations",
  "problem solving",
  "programming",
  "reporting",
  "research",
  "software",
  "strategy",
  "support",
  "teamwork",
  "technology",
])

const STOPWORDS = new Set([
  "about",
  "above",
  "across",
  "after",
  "again",
  "against",
  "all",
  "along",
  "also",
  "although",
  "among",
  "and",
  "any",
  "applicant",
  "applicants",
  "around",
  "background",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "bring",
  "but",
  "candidate",
  "candidates",
  "can",
  "company",
  "currently",
  "deliver",
  "demonstrated",
  "demonstrates",
  "demonstrating",
  "desired",
  "detail",
  "doing",
  "each",
  "ensure",
  "excellent",
  "expect",
  "familiarity",
  "from",
  "good",
  "great",
  "have",
  "help",
  "high",
  "highly",
  "ideal",
  "include",
  "including",
  "individual",
  "into",
  "its",
  "job",
  "knowledge",
  "level",
  "like",
  "looking",
  "maintain",
  "manage",
  "many",
  "minimum",
  "must",
  "need",
  "needs",
  "nice",
  "office",
  "one",
  "other",
  "our",
  "overall",
  "part",
  "people",
  "plus",
  "position",
  "positions",
  "preferred",
  "present",
  "problem",
  "process",
  "professional",
  "proficiency",
  "provide",
  "quality",
  "related",
  "require",
  "required",
  "requirement",
  "requirements",
  "responsibilities",
  "responsibility",
  "resume",
  "role",
  "seeking",
  "should",
  "similar",
  "skill",
  "skills",
  "solid",
  "some",
  "strong",
  "success",
  "such",
  "team",
  "teams",
  "their",
  "them",
  "there",
  "these",
  "this",
  "those",
  "through",
  "understanding",
  "using",
  "various",
  "well",
  "will",
  "with",
  "within",
  "work",
  "working",
  "years",
  "year",
  "you",
  "your",
])

const REQUIRED_LINE_MARKERS = [
  "must have",
  "must-have",
  "required",
  "requirements",
  "minimum qualifications",
  "basic qualifications",
  "experience with",
  "hands-on",
  "proficient in",
  "strong understanding of",
  "expertise in",
  "you have",
  "need to",
]

const PREFERRED_LINE_MARKERS = [
  "preferred",
  "nice to have",
  "nice-to-have",
  "bonus",
  "plus",
  "desired",
  "ideally",
  "preferred qualifications",
  "would be great",
]

const RESPONSIBILITY_LINE_MARKERS = [
  "responsibilities",
  "what you'll do",
  "what you will do",
  "you will",
  "in this role",
  "day to day",
  "day-to-day",
  "your impact",
  "responsible for",
]

const MANAGEMENT_MARKERS = [
  "coach",
  "develop team",
  "direct reports",
  "hiring",
  "hire",
  "lead team",
  "manage team",
  "manage engineers",
  "management",
  "mentor",
  "people manager",
  "people management",
  "staffing",
]

const REMOTE_TERMS = ["remote", "hybrid", "onsite", "on-site", "distributed", "in-office"]

const BUSINESS_IMPACT_TERMS = [
  "adoption",
  "arr",
  "availability",
  "cac",
  "conversion",
  "cost",
  "csat",
  "efficiency",
  "engagement",
  "latency",
  "margin",
  "nps",
  "reliability",
  "retention",
  "revenue",
  "roi",
  "satisfaction",
  "savings",
  "throughput",
  "time to market",
  "time-to-market",
  "uptime",
]

const SOFT_SKILL_TERMS = [
  "collaboration",
  "communication",
  "critical thinking",
  "customer focus",
  "decision making",
  "leadership",
  "mentorship",
  "negotiation",
  "ownership",
  "problem solving",
  "stakeholder management",
  "strategic thinking",
]

const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "associate",
  "mid",
  "senior",
  "lead",
  "staff",
  "principal",
  "manager",
  "director",
  "head",
  "vp",
] as const

const TECHNICAL_CATEGORIES: CanonicalTermCategory[] = [
  "language",
  "framework",
  "cloud",
  "devops",
  "data",
  "analytics",
  "ai",
  "security",
  "testing",
  "methodology",
]

const KEYWORD_VARIANT_GROUPS: KeywordVariantGroup[] = [
  term("software engineer", "title", ["software engineer", "software developer", "application engineer"]),
  term("frontend engineer", "title", ["frontend engineer", "front end engineer", "frontend developer", "front end developer"]),
  term("backend engineer", "title", ["backend engineer", "back end engineer", "backend developer", "back end developer"]),
  term("full stack engineer", "title", ["full stack engineer", "full-stack engineer", "full stack developer", "full-stack developer"]),
  term("mobile engineer", "title", ["mobile engineer", "ios engineer", "android engineer", "mobile developer"]),
  term("devops engineer", "title", ["devops engineer", "platform engineer", "site reliability engineer", "sre"]),
  term("data engineer", "title", ["data engineer", "analytics engineer", "etl engineer"]),
  term("data scientist", "title", ["data scientist", "applied scientist", "research scientist"]),
  term("machine learning engineer", "title", ["machine learning engineer", "ml engineer", "ai engineer", "artificial intelligence engineer"]),
  term("product manager", "title", ["product manager", "technical product manager", "group product manager"]),
  term("project manager", "title", ["project manager", "project lead"]),
  term("program manager", "title", ["program manager", "program lead", "technical program manager", "tpm"]),
  term("business analyst", "title", ["business analyst", "systems analyst"]),
  term("data analyst", "title", ["data analyst", "business intelligence analyst", "bi analyst"]),
  term("ux designer", "title", ["ux designer", "product designer", "ui ux designer", "ui/ux designer", "user experience designer"]),
  term("marketing manager", "title", ["marketing manager", "growth marketing manager", "digital marketing manager"]),
  term("customer success manager", "title", ["customer success manager", "client success manager", "customer success lead"]),
  term("account executive", "title", ["account executive", "sales executive", "enterprise account executive"]),
  term("security engineer", "title", ["security engineer", "application security engineer", "cybersecurity engineer"]),
  term("qa engineer", "title", ["qa engineer", "quality assurance engineer", "test engineer", "software development engineer in test", "sdet"]),
  term("finance manager", "title", ["finance manager", "fp&a manager", "financial planning and analysis manager"]),
  term("operations manager", "title", ["operations manager", "business operations manager", "program operations manager"]),

  term("javascript", "language", ["javascript", "js"]),
  term("typescript", "language", ["typescript", "ts"]),
  term("python", "language", ["python"]),
  term("java", "language", ["java"]),
  term("c#", "language", ["c#", "c sharp"]),
  term("c++", "language", ["c++"]),
  term("go", "language", ["go", "golang"]),
  term("ruby", "language", ["ruby"]),
  term("php", "language", ["php"]),
  term("swift", "language", ["swift"]),
  term("kotlin", "language", ["kotlin"]),
  term("scala", "language", ["scala"]),
  term("rust", "language", ["rust"]),
  term("sql", "language", ["sql", "structured query language"]),
  term("r", "language", ["r language", "r programming"]),
  term("html", "language", ["html", "html5"]),
  term("css", "language", ["css", "css3", "scss", "sass"]),
  term("bash", "language", ["bash", "shell scripting", "shell"]),
  term("powershell", "language", ["powershell"]),

  term("react", "framework", ["react", "react.js", "reactjs"]),
  term("next.js", "framework", ["next.js", "nextjs", "next js"]),
  term("vue", "framework", ["vue", "vue.js", "vuejs"]),
  term("angular", "framework", ["angular", "angularjs"]),
  term("svelte", "framework", ["svelte", "sveltekit"]),
  term("redux", "framework", ["redux", "redux toolkit"]),
  term("tailwind css", "framework", ["tailwind", "tailwind css"]),
  term("node.js", "framework", ["node", "node.js", "nodejs"]),
  term("express", "framework", ["express", "express.js", "expressjs"]),
  term("nestjs", "framework", ["nestjs", "nest.js", "nest js"]),
  term(".net", "framework", [".net", "dotnet", ".net core", "asp.net", "asp net"]),
  term("spring boot", "framework", ["spring boot", "springboot", "spring"]),
  term("django", "framework", ["django"]),
  term("flask", "framework", ["flask"]),
  term("fastapi", "framework", ["fastapi", "fast api"]),
  term("laravel", "framework", ["laravel"]),
  term("ruby on rails", "framework", ["ruby on rails", "rails"]),
  term("graphql", "framework", ["graphql"]),
  term("rest api", "framework", ["rest api", "restful api", "restful services", "api development"]),
  term("microservices", "framework", ["microservices", "microservice architecture", "service oriented architecture"]),
  term("react native", "framework", ["react native"]),
  term("ios", "framework", ["ios", "iphone os"]),
  term("android", "framework", ["android"]),

  term("aws", "cloud", ["aws", "amazon web services"]),
  term("azure", "cloud", ["azure", "microsoft azure"]),
  term("gcp", "cloud", ["gcp", "google cloud", "google cloud platform"]),
  term("docker", "devops", ["docker"]),
  term("kubernetes", "devops", ["kubernetes", "k8s"]),
  term("terraform", "devops", ["terraform"]),
  term("ansible", "devops", ["ansible"]),
  term("cloudformation", "devops", ["cloudformation", "aws cloudformation"]),
  term("helm", "devops", ["helm"]),
  term("github actions", "devops", ["github actions", "gha"]),
  term("gitlab ci", "devops", ["gitlab ci", "gitlab pipelines"]),
  term("jenkins", "devops", ["jenkins"]),
  term("circleci", "devops", ["circleci", "circle ci"]),
  term("argo cd", "devops", ["argo cd", "argocd"]),
  term("linux", "devops", ["linux", "unix"]),
  term("datadog", "devops", ["datadog"]),
  term("prometheus", "devops", ["prometheus"]),
  term("grafana", "devops", ["grafana"]),
  term("incident management", "operations", ["incident management", "incident response", "on-call"]),
  term("sre", "devops", ["site reliability engineering", "site reliability engineer", "sre"]),

  term("postgresql", "data", ["postgresql", "postgres", "postgre sql"]),
  term("mysql", "data", ["mysql"]),
  term("sql server", "data", ["sql server", "mssql", "microsoft sql server"]),
  term("oracle", "data", ["oracle", "oracle database"]),
  term("mongodb", "data", ["mongodb", "mongo"]),
  term("dynamodb", "data", ["dynamodb", "dynamo db"]),
  term("redis", "data", ["redis"]),
  term("elasticsearch", "data", ["elasticsearch", "elastic search", "elastic"]),
  term("snowflake", "data", ["snowflake"]),
  term("bigquery", "data", ["bigquery", "big query"]),
  term("redshift", "data", ["redshift", "amazon redshift"]),
  term("kafka", "data", ["kafka", "apache kafka"]),
  term("spark", "data", ["spark", "apache spark", "pyspark"]),
  term("hadoop", "data", ["hadoop"]),
  term("airflow", "data", ["airflow", "apache airflow"]),
  term("dbt", "data", ["dbt", "data build tool"]),
  term("tableau", "analytics", ["tableau"]),
  term("power bi", "analytics", ["power bi", "powerbi"]),
  term("looker", "analytics", ["looker", "looker studio"]),
  term("excel", "analytics", ["excel", "microsoft excel"]),
  term("a/b testing", "analytics", ["a/b testing", "ab testing", "split testing", "experimentation"]),
  term("forecasting", "analytics", ["forecasting", "predictive modeling"]),

  term("machine learning", "ai", ["machine learning", "ml"]),
  term("deep learning", "ai", ["deep learning"]),
  term("tensorflow", "ai", ["tensorflow"]),
  term("pytorch", "ai", ["pytorch", "py torch"]),
  term("scikit-learn", "ai", ["scikit-learn", "sklearn"]),
  term("nlp", "ai", ["nlp", "natural language processing"]),
  term("computer vision", "ai", ["computer vision"]),
  term("llm", "ai", ["llm", "large language model", "large language models"]),
  term("generative ai", "ai", ["generative ai", "gen ai", "genai"]),
  term("mlops", "ai", ["mlops", "machine learning operations"]),
  term("prompt engineering", "ai", ["prompt engineering", "prompt design"]),

  term("cybersecurity", "security", ["cybersecurity", "cyber security", "information security"]),
  term("iam", "security", ["iam", "identity and access management"]),
  term("oauth", "security", ["oauth", "oauth2", "oauth 2.0"]),
  term("sso", "security", ["sso", "single sign-on", "single sign on"]),
  term("penetration testing", "security", ["penetration testing", "pen testing", "pentesting"]),
  term("vulnerability management", "security", ["vulnerability management", "vulnerability assessment"]),
  term("application security", "security", ["application security", "appsec", "app sec"]),

  term("quality assurance", "testing", ["quality assurance", "qa"]),
  term("test automation", "testing", ["test automation", "automated testing"]),
  term("selenium", "testing", ["selenium"]),
  term("cypress", "testing", ["cypress"]),
  term("playwright", "testing", ["playwright"]),
  term("jest", "testing", ["jest"]),
  term("pytest", "testing", ["pytest", "py test"]),
  term("junit", "testing", ["junit", "j unit"]),
  term("tdd", "testing", ["tdd", "test driven development", "test-driven development"]),

  term("agile", "methodology", ["agile"]),
  term("scrum", "methodology", ["scrum"]),
  term("kanban", "methodology", ["kanban"]),
  term("jira", "methodology", ["jira"]),
  term("confluence", "methodology", ["confluence"]),
  term("ci/cd", "methodology", ["ci/cd", "continuous integration", "continuous delivery", "continuous deployment"]),
  term("okr", "methodology", ["okr", "okrs", "objectives and key results"]),
  term("kpi", "methodology", ["kpi", "kpis", "key performance indicator", "key performance indicators"]),

  term("product management", "product", ["product management", "product strategy"]),
  term("roadmap", "product", ["roadmap", "product roadmap"]),
  term("user research", "product", ["user research", "customer research"]),
  term("stakeholder management", "product", ["stakeholder management", "executive communication"]),
  term("go to market", "product", ["go to market", "gtm"]),
  term("pricing", "product", ["pricing", "packaging"]),

  term("ux", "design", ["ux", "user experience"]),
  term("ui", "design", ["ui", "user interface"]),
  term("figma", "design", ["figma"]),
  term("wireframing", "design", ["wireframing", "wireframes"]),
  term("prototyping", "design", ["prototyping", "prototype"]),
  term("design systems", "design", ["design systems", "design system"]),
  term("accessibility", "design", ["accessibility", "a11y"]),
  term("adobe creative suite", "design", ["adobe creative suite", "creative suite", "photoshop", "illustrator"]),

  term("seo", "marketing", ["seo", "search engine optimization"]),
  term("sem", "marketing", ["sem", "search engine marketing"]),
  term("google ads", "marketing", ["google ads", "adwords", "google adwords"]),
  term("meta ads", "marketing", ["meta ads", "facebook ads", "instagram ads"]),
  term("content marketing", "marketing", ["content marketing", "content strategy"]),
  term("demand generation", "marketing", ["demand generation", "demand gen"]),
  term("marketing automation", "marketing", ["marketing automation"]),
  term("conversion optimization", "marketing", ["conversion optimization", "cro"]),
  term("email marketing", "marketing", ["email marketing", "lifecycle marketing"]),
  term("hubspot", "marketing", ["hubspot", "hub spot"]),

  term("salesforce", "sales", ["salesforce", "sfdc"]),
  term("crm", "sales", ["crm", "customer relationship management"]),
  term("pipeline management", "sales", ["pipeline management", "sales pipeline"]),
  term("account management", "sales", ["account management", "client management"]),
  term("quota attainment", "sales", ["quota attainment", "quota achievement"]),
  term("prospecting", "sales", ["prospecting", "lead generation"]),
  term("closing", "sales", ["closing", "deal closing"]),

  term("financial modeling", "finance", ["financial modeling", "financial model"]),
  term("budgeting", "finance", ["budgeting", "budget management"]),
  term("forecasting", "finance", ["financial forecasting", "forecasting"]),
  term("fp&a", "finance", ["fp&a", "financial planning and analysis"]),
  term("gaap", "finance", ["gaap"]),
  term("accounting", "finance", ["accounting"]),
  term("p&l", "finance", ["p&l", "profit and loss"]),
  term("variance analysis", "finance", ["variance analysis"]),

  term("operations", "operations", ["operations", "operational excellence"]),
  term("process improvement", "operations", ["process improvement", "continuous improvement"]),
  term("vendor management", "operations", ["vendor management"]),
  term("change management", "operations", ["change management"]),
  term("compliance operations", "operations", ["compliance operations"]),
  term("supply chain", "operations", ["supply chain", "logistics"]),

  term("customer success", "customer", ["customer success"]),
  term("onboarding", "customer", ["onboarding", "implementation"]),
  term("retention", "customer", ["retention"]),
  term("churn", "customer", ["churn"]),
  term("support", "customer", ["technical support", "customer support", "support operations"]),

  term("leadership", "soft-skill", ["leadership"]),
  term("communication", "soft-skill", ["communication", "executive communication"]),
  term("collaboration", "soft-skill", ["collaboration", "cross-functional collaboration"]),
  term("problem solving", "soft-skill", ["problem solving", "problem-solving"]),
  term("ownership", "soft-skill", ["ownership"]),
  term("mentorship", "soft-skill", ["mentorship", "mentoring"]),
  term("adaptability", "soft-skill", ["adaptability", "adaptable"]),
  term("strategic thinking", "soft-skill", ["strategic thinking", "strategy"]),

  term("gdpr", "compliance", ["gdpr", "general data protection regulation"]),
  term("hipaa", "compliance", ["hipaa"]),
  term("pci-dss", "compliance", ["pci-dss", "pci dss"]),
  term("soc 2", "compliance", ["soc 2", "soc2"]),
  term("sox", "compliance", ["sox", "sarbanes oxley"]),
  term("iso 27001", "compliance", ["iso 27001"]),
  term("risk management", "compliance", ["risk management", "risk assessment"]),

  term("metrics", "business", ["metrics", "metric driven", "data driven", "data-driven"]),
  term("optimization", "business", ["optimization", "optimize", "optimized"]),
  term("scalability", "business", ["scalability", "scalable", "at scale"]),
  term("performance", "business", ["performance", "performance optimization"]),
  term("efficiency", "business", ["efficiency", "productivity"]),
  term("customer obsession", "business", ["customer obsession", "customer centric", "customer-centric"]),
  term("innovation", "business", ["innovation", "innovative"]),

  term("aws certified", "certification", ["aws certified", "aws certification"]),
  term("azure certification", "certification", ["azure certification", "microsoft certified azure"]),
  term("google cloud certification", "certification", ["google cloud certification", "gcp certification"]),
  term("pmp", "certification", ["pmp", "project management professional"]),
  term("scrum master certification", "certification", ["certified scrum master", "scrum master certification", "csm", "psm"]),
  term("cissp", "certification", ["cissp"]),
  term("security+", "certification", ["security+", "comptia security+"]),
  term("cka", "certification", ["cka", "certified kubernetes administrator"]),
  term("ckad", "certification", ["ckad", "certified kubernetes application developer"]),
  term("ccna", "certification", ["ccna"]),
  term("ccnp", "certification", ["ccnp"]),
  term("salesforce certified", "certification", ["salesforce certified", "salesforce certification"]),
  term("itil", "certification", ["itil", "itil foundation"]),
  term("six sigma", "certification", ["six sigma", "lean six sigma"]),
  term("cfa", "certification", ["cfa", "chartered financial analyst"]),
  term("frm", "certification", ["frm", "financial risk manager"]),
]

const ROLE_FAMILY_DEFINITIONS: RoleFamilyDefinition[] = [
  {
    id: "software-engineering",
    titles: ["software engineer", "backend engineer", "full stack engineer"],
    keywords: ["api", "microservices", "distributed systems", "ci/cd", "cloud", "testing"],
  },
  {
    id: "frontend-engineering",
    titles: ["frontend engineer", "frontend developer", "ui engineer"],
    keywords: ["react", "next.js", "typescript", "javascript", "accessibility", "design systems"],
  },
  {
    id: "backend-engineering",
    titles: ["backend engineer", "backend developer"],
    keywords: ["api", "node.js", "python", "java", "microservices", "postgresql"],
  },
  {
    id: "mobile-engineering",
    titles: ["mobile engineer", "ios engineer", "android engineer"],
    keywords: ["ios", "android", "swift", "kotlin", "react native"],
  },
  {
    id: "devops-platform",
    titles: ["devops engineer", "platform engineer", "site reliability engineer", "sre"],
    keywords: ["aws", "kubernetes", "docker", "terraform", "incident management", "linux"],
  },
  {
    id: "data-engineering",
    titles: ["data engineer", "analytics engineer"],
    keywords: ["etl", "airflow", "dbt", "spark", "kafka", "snowflake"],
  },
  {
    id: "data-science-analytics",
    titles: ["data scientist", "data analyst", "business intelligence analyst"],
    keywords: ["python", "sql", "machine learning", "tableau", "power bi", "a/b testing"],
  },
  {
    id: "machine-learning-ai",
    titles: ["machine learning engineer", "ai engineer", "applied scientist"],
    keywords: ["machine learning", "llm", "generative ai", "pytorch", "tensorflow", "mlops"],
  },
  {
    id: "product-management",
    titles: ["product manager", "technical product manager"],
    keywords: ["roadmap", "product management", "stakeholder management", "user research", "go to market", "metrics"],
  },
  {
    id: "program-project-management",
    titles: ["program manager", "project manager", "technical program manager"],
    keywords: ["agile", "scrum", "jira", "risk management", "stakeholder management", "delivery"],
  },
  {
    id: "design-ux",
    titles: ["ux designer", "product designer", "ui ux designer"],
    keywords: ["ux", "ui", "figma", "wireframing", "prototyping", "accessibility"],
  },
  {
    id: "marketing-growth",
    titles: ["marketing manager", "growth marketing manager", "digital marketing manager"],
    keywords: ["seo", "sem", "google ads", "meta ads", "content marketing", "conversion optimization"],
  },
  {
    id: "sales-customer",
    titles: ["account executive", "customer success manager", "sales manager"],
    keywords: ["crm", "salesforce", "pipeline management", "quota attainment", "retention", "onboarding"],
  },
  {
    id: "finance-operations",
    titles: ["finance manager", "operations manager", "business operations manager"],
    keywords: ["fp&a", "budgeting", "forecasting", "variance analysis", "process improvement", "operations"],
  },
  {
    id: "security",
    titles: ["security engineer", "application security engineer", "cybersecurity engineer"],
    keywords: ["cybersecurity", "iam", "oauth", "sso", "vulnerability management", "cissp"],
  },
  {
    id: "quality-engineering",
    titles: ["qa engineer", "test engineer", "sdet"],
    keywords: ["quality assurance", "test automation", "selenium", "cypress", "playwright", "tdd"],
  },
]

const KEYWORD_GROUP_MAP = new Map(KEYWORD_VARIANT_GROUPS.map((group) => [group.canonical, group]))
const KEYWORD_ALIAS_MAP = new Map<string, string>()

for (const group of KEYWORD_VARIANT_GROUPS) {
  KEYWORD_ALIAS_MAP.set(group.canonical, group.canonical)
  for (const variant of group.variants) {
    KEYWORD_ALIAS_MAP.set(variant.toLowerCase().trim(), group.canonical)
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function round(value: number): number {
  return Math.round(value)
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim()
}

function splitLines(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim())
    .filter(Boolean)
}

function normalizeHeadingCandidate(value: string): string {
  return value
    .toLowerCase()
    .replace(/[:|\-]+$/g, "")
    .replace(/[()]/g, " ")
    .replace(/[&/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9][a-z0-9+#./-]{1,}/g) || []).filter(Boolean)
}

function normalizeSimilarityToken(token: string): string {
  let normalized = token.toLowerCase()
  if (normalized.endsWith("ies") && normalized.length > 4) normalized = `${normalized.slice(0, -3)}y`
  else if (normalized.endsWith("ing") && normalized.length > 5) normalized = normalized.slice(0, -3)
  else if (normalized.endsWith("ed") && normalized.length > 4) normalized = normalized.slice(0, -2)
  else if (normalized.endsWith("es") && normalized.length > 4) normalized = normalized.slice(0, -2)
  else if (normalized.endsWith("s") && normalized.length > 3) normalized = normalized.slice(0, -1)
  if (normalized.endsWith("ment") && normalized.length > 6) normalized = normalized.slice(0, -4)
  if (normalized.endsWith("manage")) normalized = normalized.slice(0, -1)
  return normalized
}

function tokenizeForSimilarity(value: string): string[] {
  return unique(
    tokenize(value)
      .map((token) => normalizeSimilarityToken(token))
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  )
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildTermPattern(termValue: string): RegExp {
  let body = escapeRegExp(termValue.toLowerCase().trim())
  body = body.replace(/\\ /g, "[\\s\\u00a0]+")
  body = body.replace(/\\\//g, "[\\s/-]*")
  body = body.replace(/\\-/g, "[-\\s]?")
  body = body.replace(/\\&/g, "(?:&|and)")
  return new RegExp(`(^|[^a-z0-9+#.])${body}(?=$|[^a-z0-9+#.])`, "i")
}

function countRegexMatches(text: string, pattern: RegExp): number {
  const globalPattern = new RegExp(pattern.source, `${pattern.flags.includes("i") ? "i" : ""}g`)
  return (text.match(globalPattern) || []).length
}

function resolveCanonicalTerm(termValue: string): string {
  const lookup = termValue.toLowerCase().trim()
  return KEYWORD_ALIAS_MAP.get(lookup) || lookup
}

function getTermVariants(termValue: string): string[] {
  const canonical = resolveCanonicalTerm(termValue)
  const group = KEYWORD_GROUP_MAP.get(canonical)
  if (!group) return [termValue.toLowerCase().trim()]
  return unique([group.canonical, ...group.variants].map((value) => value.toLowerCase().trim()))
}

function containsTerm(text: string, termValue: string): boolean {
  const normalizedText = text.toLowerCase()
  return getTermVariants(termValue).some((variant) => buildTermPattern(variant).test(normalizedText))
}

function countOccurrences(haystack: string, needle: string): number {
  const normalizedText = haystack.toLowerCase()
  return getTermVariants(needle).reduce((sum, variant) => sum + countRegexMatches(normalizedText, buildTermPattern(variant)), 0)
}

function textIncludesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => containsTerm(text, candidate))
}

function classifyStatus(score: number): ATSSectionReview["status"] {
  if (score >= 85) return "strong"
  if (score >= 70) return "good"
  if (score >= 55) return "needs-work"
  return "weak"
}

function rankMapKeys(map: Map<string, number>, limit: number): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value)
    .slice(0, limit)
}

function addTermsToMap(target: Map<string, number>, values: string[], weight = 1) {
  for (const rawValue of values) {
    const value = resolveCanonicalTerm(rawValue)
    if (!value) continue
    if (STOPWORDS.has(value)) continue
    if (value.length < 2) continue
    target.set(value, (target.get(value) || 0) + weight)
  }
}

function extractCanonicalTermCounts(
  text: string,
  categories?: CanonicalTermCategory[]
): Map<string, number> {
  const counts = new Map<string, number>()
  const normalizedText = text.toLowerCase()
  for (const group of KEYWORD_VARIANT_GROUPS) {
    if (categories && !categories.includes(group.category)) continue
    const count = group.variants.reduce(
      (sum, variant) => sum + countRegexMatches(normalizedText, buildTermPattern(variant)),
      0
    )
    if (count > 0) counts.set(group.canonical, count)
  }
  return counts
}

function extractCanonicalTerms(text: string, categories?: CanonicalTermCategory[]): string[] {
  return rankMapKeys(extractCanonicalTermCounts(text, categories), 200)
}

function extractTermsFromLine(line: string): string[] {
  const canonicalTerms = extractCanonicalTerms(line)
  const rawTokens = tokenize(line).filter(
    (token) => token.length >= 3 && !STOPWORDS.has(token) && !/^\d/.test(token)
  )
  return unique([...canonicalTerms, ...rawTokens]).slice(0, 20)
}

function isLikelyHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 72) return false
  if (/[.!?]$/.test(trimmed) && !/:$/.test(trimmed)) return false
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 8) return false
  const letters = trimmed.replace(/[^A-Za-z]/g, "")
  const uppercaseLetters = trimmed.replace(/[^A-Z]/g, "").length
  const uppercaseRatio = letters.length > 0 ? uppercaseLetters / letters.length : 0
  return /:$/.test(trimmed) || uppercaseRatio >= 0.6 || words.every((word) => /^[A-Z][A-Za-z&/+-]*$/.test(word))
}

function detectSectionKeyFromHeading(line: string): SectionKey | null {
  const normalized = normalizeHeadingCandidate(line)
  const headingTokens = new Set(tokenizeForSimilarity(normalized))

  for (const [key, aliases] of Object.entries(SECTION_ALIASES) as Array<[SectionKey, readonly string[]]>) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeadingCandidate(alias)
      if (normalized === normalizedAlias) return key
      if (!isLikelyHeadingLine(line)) continue

      const aliasTokens = tokenizeForSimilarity(normalizedAlias)
      const matchedTokens = aliasTokens.filter((token) => headingTokens.has(token)).length
      if (aliasTokens.length > 0 && matchedTokens === aliasTokens.length) return key
      if (aliasTokens.length >= 2 && matchedTokens / aliasTokens.length >= 0.75) return key
      if (normalized.startsWith(`${normalizedAlias} `) || normalized.includes(` ${normalizedAlias}`)) return key
    }
  }

  if (isLikelyHeadingLine(line)) {
    if (/\b(summary|profile|overview|qualifications?|highlights?)\b/i.test(normalized)) return "professionalSummary"
    if (/\b(experience|employment|background|career history)\b/i.test(normalized)) return "workExperience"
    if (/\b(skills?|tools?|technologies|competencies|proficiencies|stack)\b/i.test(normalized)) return "skills"
    if (/\b(education|academics?|training)\b/i.test(normalized)) return "education"
    if (/\b(certifications?|licenses?|licences?|certificates?)\b/i.test(normalized)) return "certifications"
    if (/\b(projects?|portfolio)\b/i.test(normalized)) return "projects"
    if (/\b(publications?|research|patents?)\b/i.test(normalized)) return "publications"
  }

  return null
}

function findTermEvidenceInLines(lines: string[], termValue: string): { exact: boolean; semantic: boolean } {
  const normalizedTerm = termValue.toLowerCase().trim()
  const termTokens = tokenizeForSimilarity(normalizedTerm)
  if (termTokens.length === 0) return { exact: false, semantic: false }

  for (const line of lines) {
    if (containsTerm(line, normalizedTerm)) return { exact: true, semantic: false }
  }

  if (termTokens.length < 2) return { exact: false, semantic: false }

  for (const line of lines) {
    const lineTokens = new Set(tokenizeForSimilarity(line))
    const overlap = termTokens.filter((token) => lineTokens.has(token)).length
    if (overlap / termTokens.length >= 0.75) return { exact: false, semantic: true }
  }

  return { exact: false, semantic: false }
}

function computeDocumentParseRisk(text: string): {
  issues: string[]
  warnings: string[]
  riskPenalty: number
} {
  const issues: string[] = []
  const warnings: string[] = []
  let riskPenalty = 0

  if (/\\begin\{(?:tabular|table|multicols|minipage)\}|\\multicolumn|\\multirow|\\fancyhead|\\fancyfoot/i.test(text)) {
    issues.push("LaTeX layout commands suggest tables, columns, or header/footer content that ATS parsers often skip.")
    riskPenalty += 12
  }

  if (/\|[^\n|]+\|[^\n|]+\|/.test(text) || /^\s*\|.+\|\s*$/m.test(text)) {
    warnings.push("Detected table-like separators that may indicate columnar content or markdown tables.")
    riskPenalty += 6
  }

  if (/<table|<tr|<td|<div|<span/i.test(text)) {
    warnings.push("HTML-style markup appears in the resume text and may not survive ATS extraction cleanly.")
    riskPenalty += 5
  }

  const lines = splitLines(text)
  const shortStructuredLines = lines.filter(
    (line) =>
      line.length >= 8 &&
      line.length <= 40 &&
      /[|•·]/.test(line) &&
      !/@/.test(line) &&
      !/^[-*•]/.test(line)
  ).length
  if (shortStructuredLines >= 6) {
    warnings.push("Many short separator-heavy lines suggest visual layout formatting rather than plain linear text.")
    riskPenalty += 5
  }

  const fragmentedLines = lines.filter((line) => line.split(/\s+/).length <= 3 && line.length >= 8).length
  if (lines.length > 0 && fragmentedLines / lines.length >= 0.22) {
    warnings.push("The text contains many fragmented short lines, which can indicate reading-order or column extraction issues.")
    riskPenalty += 4
  }

  return { issues, warnings, riskPenalty }
}

function detectSectionKey(line: string): SectionKey | null {
  return detectSectionKeyFromHeading(line)
}

function extractSections(text: string): {
  sections: Partial<Record<SectionKey, SectionBlock>>
  order: string[]
} {
  const lines = splitLines(text)
  const sections: Partial<Record<SectionKey, SectionBlock>> = {}
  const order: string[] = []

  let currentKey: SectionKey | null = null
  let currentTitle = ""
  let buffer: string[] = []

  const flush = () => {
    if (!currentKey) return
    sections[currentKey] = {
      key: currentKey,
      title: currentTitle,
      content: buffer.join("\n").trim(),
      lines: [...buffer],
    }
    order.push(currentKey)
  }

  for (const line of lines) {
    const detected = detectSectionKey(line)
    if (detected) {
      flush()
      currentKey = detected
      currentTitle = line
      buffer = []
      continue
    }
    if (currentKey) buffer.push(line)
  }

  flush()
  return { sections, order }
}

function extractSectionsFromArtifacts(artifacts: DocumentArtifacts | null | undefined): {
  sections: Partial<Record<SectionKey, SectionBlock>>
  order: string[]
} {
  if (!artifacts?.blocks?.length) return { sections: {}, order: [] }

  const sections: Partial<Record<SectionKey, SectionBlock>> = {}
  const order: string[] = []
  let currentKey: SectionKey | null = null
  let currentTitle = ""
  let buffer: string[] = []

  const flush = () => {
    if (!currentKey || buffer.length === 0) return
    sections[currentKey] = {
      key: currentKey,
      title: currentTitle,
      content: buffer.join("\n").trim(),
      lines: [...buffer],
    }
    order.push(currentKey)
  }

  for (const block of artifacts.blocks) {
    const detected = block.kind === "heading" ? detectSectionKey(block.text) : null
    if (detected) {
      flush()
      currentKey = detected
      currentTitle = block.text
      buffer = []
      continue
    }
    if (!currentKey) continue
    if (block.kind === "heading") {
      flush()
      currentKey = null
      currentTitle = ""
      buffer = []
      continue
    }
    buffer.push(block.text)
  }

  flush()
  return { sections, order }
}

function mergeSectionResults(
  primary: { sections: Partial<Record<SectionKey, SectionBlock>>; order: string[] },
  fallback: { sections: Partial<Record<SectionKey, SectionBlock>>; order: string[] }
): { sections: Partial<Record<SectionKey, SectionBlock>>; order: string[] } {
  const sections: Partial<Record<SectionKey, SectionBlock>> = { ...primary.sections }
  for (const [key, section] of Object.entries(fallback.sections) as Array<[SectionKey, SectionBlock | undefined]>) {
    if (!sections[key] && section) sections[key] = section
  }

  const order = unique([...primary.order, ...fallback.order])
  return { sections, order }
}

function deriveDocumentStructureSignals(artifacts: DocumentArtifacts | null | undefined): DocumentStructureSignals {
  if (!artifacts) {
    return {
      detectedSections: [],
      contactInHeaderFooter: false,
      hasTableEvidence: false,
      hasMultiColumnEvidence: false,
      readingOrderRisk: 0,
    }
  }

  const detectedSections = unique(
    artifacts.blocks
      .filter((block) => block.kind === "heading")
      .map((block) => detectSectionKey(block.text))
      .filter((value): value is SectionKey => Boolean(value))
  )

  return {
    detectedSections,
    contactInHeaderFooter:
      artifacts.layout.hasHeaderFooterEvidence &&
      artifacts.blocks.some((block) => block.kind === "contact"),
    hasTableEvidence: artifacts.layout.hasTableEvidence,
    hasMultiColumnEvidence: artifacts.layout.hasMultiColumnEvidence,
    readingOrderRisk: artifacts.layout.readingOrderRisk,
  }
}

function detectContactInfo(text: string): ContactInfo {
  const topText = splitLines(text).slice(0, 12).join("\n")
  const emailMatch = topText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const emailValue = emailMatch?.[0].toLowerCase() || ""
  const localPart = emailValue.split("@")[0] || ""

  return {
    email: Boolean(emailMatch),
    phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.test(topText),
    location:
      /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(topText) ||
      /\b[A-Z][a-z]+,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/.test(topText) ||
      /\bremote\b/i.test(topText),
    url: /(linkedin\.com|github\.com|portfolio|http:\/\/|https:\/\/)/i.test(topText),
    linkedin: /linkedin\.com\/in\//i.test(topText),
    github: /github\.com\//i.test(topText),
    professionalEmail:
      Boolean(emailMatch) &&
      !/(?:princess|baby|coolguy|cutie|hotgirl|sexy|swag)/i.test(localPart) &&
      !/\d{5,}/.test(localPart),
  }
}

function extractDateInfo(text: string): DateInfo {
  const formats = new Set<string>()
  const futureDates: string[] = []
  const intervals: Array<{ start: number; end: number }> = []

  const monthMap: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  }

  const toMonthIndex = (year: number, month: number) => year * 12 + month
  const pushInterval = (startYear: number, startMonth: number, endYear: number, endMonth: number) => {
    const start = toMonthIndex(startYear, startMonth)
    const end = toMonthIndex(endYear, endMonth)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      intervals.push({ start, end })
    }
  }

  let match: RegExpExecArray | null

  const monthYearPattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+((?:19|20)\d{2})\b/gi
  while ((match = monthYearPattern.exec(text)) !== null) {
    const raw = match[0]
    const month = monthMap[match[1].toLowerCase()]
    const year = Number(match[2])
    formats.add("month-year")
    if (year > CURRENT_YEAR || (year === CURRENT_YEAR && month > CURRENT_MONTH_INDEX)) {
      futureDates.push(raw)
    }
  }

  const numericPattern = /\b(0?[1-9]|1[0-2])\/((?:19|20)\d{2})\b/g
  while ((match = numericPattern.exec(text)) !== null) {
    const raw = match[0]
    const month = Number(match[1]) - 1
    const year = Number(match[2])
    formats.add("numeric-month-year")
    if (year > CURRENT_YEAR || (year === CURRENT_YEAR && month > CURRENT_MONTH_INDEX)) {
      futureDates.push(raw)
    }
  }

  const yearPattern = /\b((?:19|20)\d{2})\b/g
  while ((match = yearPattern.exec(text)) !== null) {
    const year = Number(match[1])
    formats.add("year-only")
    if (year > CURRENT_YEAR) futureDates.push(match[1])
  }

  const numericRangePattern =
    /\b(0?[1-9]|1[0-2])\/((?:19|20)\d{2})\s*(?:-|–|to)\s*(present|current|now|(0?[1-9]|1[0-2])\/((?:19|20)\d{2}))\b/gi
  while ((match = numericRangePattern.exec(text)) !== null) {
    const startMonth = Number(match[1]) - 1
    const startYear = Number(match[2])
    const isPresent = /present|current|now/i.test(match[3])
    const endMonth = isPresent ? CURRENT_MONTH_INDEX : Number(match[4]) - 1
    const endYear = isPresent ? CURRENT_YEAR : Number(match[5])
    pushInterval(startYear, startMonth, endYear, endMonth)
  }

  const monthRangePattern =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+((?:19|20)\d{2})\s*(?:-|–|to)\s*(present|current|now|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*(((?:19|20)\d{2}))?\b/gi
  while ((match = monthRangePattern.exec(text)) !== null) {
    const startMonth = monthMap[match[1].toLowerCase()]
    const startYear = Number(match[2])
    const isPresent = /present|current|now/i.test(match[3])
    const endMonth = isPresent ? CURRENT_MONTH_INDEX : monthMap[match[3].toLowerCase()]
    const endYear = isPresent ? CURRENT_YEAR : Number(match[4])
    pushInterval(startYear, startMonth, endYear, endMonth)
  }

  const yearRangePattern =
    /\b((?:19|20)\d{2})\s*(?:-|–|to)\s*(present|current|now|(?:19|20)\d{2})\b/gi
  while ((match = yearRangePattern.exec(text)) !== null) {
    const startYear = Number(match[1])
    const isPresent = /present|current|now/i.test(match[2])
    const endYear = isPresent ? CURRENT_YEAR : Number(match[2])
    pushInterval(startYear, 0, endYear, isPresent ? CURRENT_MONTH_INDEX : 11)
  }

  const merged = [...intervals].sort((a, b) => a.start - b.start)
  let totalMonths = 0
  if (merged.length > 0) {
    let current = { ...merged[0] }
    for (let index = 1; index < merged.length; index += 1) {
      const next = merged[index]
      if (next.start <= current.end + 1) {
        current.end = Math.max(current.end, next.end)
      } else {
        totalMonths += current.end - current.start + 1
        current = { ...next }
      }
    }
    totalMonths += current.end - current.start + 1
  }

  return {
    formats: [...formats],
    consistent: formats.size <= 1,
    futureDates: unique(futureDates),
    yearsEstimated: totalMonths > 0 ? Number((totalMonths / 12).toFixed(1)) : null,
    datedRoleCount: intervals.length,
  }
}

function extractExperienceLines(sectionContent: string): string[] {
  return splitLines(sectionContent).filter((line) => {
    const cleaned = line.replace(/^[-*•]\s*/, "").trim()
    if (cleaned.length < 18) return false
    if (detectSectionKey(cleaned)) return false
    if (/^[A-Z][A-Za-z&/.,' -]{1,45}\s+\|\s+[A-Z]/.test(cleaned) && !/[.]/.test(cleaned)) return false
    if (/^(?:[A-Z][A-Za-z&/.,' -]{1,40})\s*(?:-|–|\|)\s*(?:[A-Z][A-Za-z&/.,' -]{1,40})$/.test(cleaned)) return false
    if (/((?:19|20)\d{2}|present|current|now)/i.test(cleaned) && cleaned.split(/\s+/).length <= 10) return false
    return true
  })
}

function extractBulletStats(
  experienceText: string,
  projectText: string,
  criticalTerms: string[]
): BulletStats {
  const lines = [...extractExperienceLines(experienceText), ...extractExperienceLines(projectText)]
  const total = lines.length
  let quantified = 0
  let strongVerb = 0
  let weakVerb = 0
  let totalWords = 0
  let tooShort = 0
  let tooLong = 0
  let starLike = 0
  let timeframeMentioned = 0
  let technicalSpecificity = 0
  let passiveVoice = 0
  let firstPerson = 0
  let businessImpact = 0
  let scopeMentioned = 0
  let toolMentioned = 0
  const leadVerbs = new Map<string, number>()
  const bulletMarkers = new Set<string>()
  const normalizedLines = new Map<string, number>()

  for (const line of lines) {
    const markerMatch = line.match(/^([-*•])/)
    if (markerMatch?.[1]) bulletMarkers.add(markerMatch[1])

    const normalized = line.toLowerCase().replace(/^[-*•]\s*/, "")
    const words = tokenize(normalized)
    totalWords += words.length
    if (words.length < 9) tooShort += 1
    if (words.length > 34) tooLong += 1

    const normalizedKey = words.filter((word) => !STOPWORDS.has(word) && word.length > 2).slice(0, 12).join(" ")
    if (normalizedKey) normalizedLines.set(normalizedKey, (normalizedLines.get(normalizedKey) || 0) + 1)

    const hasMetric =
      /(\d+%|\$\s?\d|€\s?\d|£\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m|b)\+?\b|\b\d+\+?\s?(?:users|customers|clients|engineers|people|projects|services|hours|days|weeks|months|years|pipelines|applications|transactions|tickets|stores|regions)\b|\b99\.9+\b|\b\d+\s?(?:ms|seconds|minutes|hours)\b)/i.test(
        normalized
      )
    if (hasMetric) quantified += 1

    const firstWord = words[0]
    if (firstWord) leadVerbs.set(firstWord, (leadVerbs.get(firstWord) || 0) + 1)
    if (firstWord && STRONG_VERBS.has(firstWord)) strongVerb += 1
    if (firstWord && WEAK_VERBS.has(firstWord)) weakVerb += 1
    if (/responsible for/i.test(normalized)) weakVerb += 1

    if (/\b(was|were|is|are|been|being)\s+\w+ed\b/i.test(normalized)) passiveVoice += 1
    if (/\b(i|my|me|our|we)\b/i.test(normalized)) firstPerson += 1

    const hasTimeframe =
      /\b(within|over|across|during|throughout|in\s+\d+\s+(days?|weeks?|months?|quarters?|years?))\b/i.test(
        normalized
      )
    if (hasTimeframe) timeframeMentioned += 1

    const canonicalTechnicalTerms = extractCanonicalTerms(line, TECHNICAL_CATEGORIES)
    const hasToolEvidence =
      canonicalTechnicalTerms.length > 0 ||
      /[A-Z]{2,}|[A-Za-z0-9]+(?:\.js|\.ts|\.py|\.net)|\b(api|sdk|aws|azure|gcp|kubernetes|docker|terraform|react|node|python|java|sql|typescript|graphql|microservices|ci\/cd)\b/i.test(
        line
      )
    if (hasToolEvidence) toolMentioned += 1
    if (canonicalTechnicalTerms.length >= 1 || criticalTerms.some((term) => containsTerm(normalized, term))) {
      technicalSpecificity += 1
    }

    const hasBusinessImpact = textIncludesAny(normalized, BUSINESS_IMPACT_TERMS)
    if (hasBusinessImpact) businessImpact += 1

    const hasScope =
      /\b(across|for|supporting|serving|covering|team of|portfolio of|organization-wide|global|enterprise|multi-region|multi region)\b/i.test(
        normalized
      )
    if (hasScope) scopeMentioned += 1

    const hasContext = /\b(using|via|through|by|for|while|to|across)\b/i.test(normalized)
    if (firstWord && STRONG_VERBS.has(firstWord) && hasMetric && (hasTimeframe || hasContext || hasBusinessImpact)) {
      starLike += 1
    }
  }

  const duplicateBullets = [...normalizedLines.values()].filter((count) => count >= 2).length
  const repeatedLeadVerbs = [...leadVerbs.entries()]
    .filter(([verb, count]) => STRONG_VERBS.has(verb) && count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([verb]) => verb)
    .slice(0, 5)

  return {
    total,
    quantified,
    strongVerb,
    weakVerb,
    averageWordCount: total > 0 ? round(totalWords / total) : 0,
    tooShort,
    tooLong,
    starLike,
    timeframeMentioned,
    technicalSpecificity,
    repeatedLeadVerbs,
    consistentMarkers: bulletMarkers.size <= 1,
    passiveVoice,
    firstPerson,
    businessImpact,
    scopeMentioned,
    toolMentioned,
    duplicateBullets,
  }
}

function analyzeSummary(summaryText: string, jd: JDAnalysis | null): SummaryStats {
  const lines = splitLines(summaryText)
  const words = tokenize(summaryText)
  const first50Words = words.slice(0, 50).join(" ")
  const criticalTerms = unique([
    ...(jd?.titleTerms || []),
    ...(jd?.requiredTerms || []).slice(0, 16),
    ...(jd?.responsibilityTerms || []).slice(0, 10),
  ])
  const first50KeywordMatches = criticalTerms.filter((term) => containsTerm(first50Words, term)).length
  const matchedCriticalTerms = criticalTerms.filter((term) => containsTerm(summaryText, term)).length

  return {
    lineCount: lines.length,
    wordCount: words.length,
    hasYears: /\b\d+\+?\s+years?\b/i.test(summaryText),
    hasMetric:
      /(\d+%|\$\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m|b)\+?\b|\b\d+\+?\s?(?:users|customers|clients|projects|teams)\b)/i.test(
        summaryText
      ),
    hasRoleTitle:
      /(engineer|developer|manager|analyst|architect|scientist|consultant|specialist|administrator|designer|director)/i.test(
        summaryText
      ),
    first50KeywordMatches,
    hasSeniority: textIncludesAny(summaryText, [...SENIORITY_LEVELS]),
    hasObjectiveLanguage: /\b(seeking|looking for|to obtain|objective|seeking a position|seeking an opportunity)\b/i.test(
      summaryText
    ),
    firstPerson: /\b(i|my|me|our|we)\b/i.test(summaryText),
    hasCoreSkills: extractCanonicalTerms(summaryText, TECHNICAL_CATEGORIES).length >= 3,
    matchedCriticalTerms,
  }
}

function analyzeRepetition(text: string, jd: JDAnalysis | null): RepetitionStats {
  const excluded = new Set(
    unique([
      ...(jd?.titleTerms || []),
      ...(jd?.requiredTerms || []),
      ...(jd?.preferredTerms || []),
      ...(jd?.cultureTerms || []),
      ...(jd?.responsibilityTerms || []),
    ]).map((term) => resolveCanonicalTerm(term))
  )
  const wordCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()

  const words = tokenize(text)
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (word.length < 4) continue
    if (STOPWORDS.has(word)) continue
    if (excluded.has(word)) continue
    if (/^\d/.test(word)) continue
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)

    const next = words[index + 1]
    const third = words[index + 2]
    if (next && !STOPWORDS.has(next) && next.length >= 4) {
      const bigram = `${word} ${next}`
      phraseCounts.set(bigram, (phraseCounts.get(bigram) || 0) + 1)
    }
    if (next && third && !STOPWORDS.has(next) && !STOPWORDS.has(third)) {
      const trigram = `${word} ${next} ${third}`
      phraseCounts.set(trigram, (phraseCounts.get(trigram) || 0) + 1)
    }
  }

  const bulletFragments = new Map<string, number>()
  for (const line of extractExperienceLines(text)) {
    const fragment = tokenize(line)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
      .slice(0, 8)
      .join(" ")
    if (fragment) bulletFragments.set(fragment, (bulletFragments.get(fragment) || 0) + 1)
  }

  return {
    repeatedContentWords: [...wordCounts.entries()]
      .filter(([_, count]) => count >= 6)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 8),
    repeatedPhrases: [...phraseCounts.entries()]
      .filter(([phrase, count]) => count >= 3 && phrase.length >= 12)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase)
      .slice(0, 6),
    duplicateBulletFragments: [...bulletFragments.entries()]
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([fragment]) => fragment)
      .slice(0, 5),
  }
}

function getSectionText(section?: SectionBlock): string {
  return section?.content || ""
}

function extractHighestDegreeRequirement(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\b(phd|doctorate|doctoral)\b/i.test(lower)) return "phd"
  if (/\b(master|m\.s|ms|mba|m\.eng)\b/i.test(lower)) return "master"
  if (/\b(bachelor|b\.s|bs|b\.a|ba|b\.eng)\b/i.test(lower)) return "bachelor"
  if (/\b(associate|a\.s|a\.a)\b/i.test(lower)) return "associate"
  return null
}

function hasDegree(text: string, degreeRequirement: string | null): boolean | null {
  if (!degreeRequirement) return null
  const lower = text.toLowerCase()
  if (degreeRequirement === "phd") {
    return /\b(phd|doctorate|doctoral)\b/i.test(lower)
  }
  if (degreeRequirement === "master") {
    return /\b(master|m\.s|ms|mba|m\.eng|phd|doctorate)\b/i.test(lower)
  }
  if (degreeRequirement === "bachelor") {
    return /\b(bachelor|b\.s|bs|b\.a|ba|b\.eng|master|m\.s|ms|mba|phd|doctorate)\b/i.test(lower)
  }
  if (degreeRequirement === "associate") {
    return /\b(associate|a\.s|a\.a|bachelor|master|phd)\b/i.test(lower)
  }
  return null
}

function extractRoleFamilies(text: string): string[] {
  return ROLE_FAMILY_DEFINITIONS.filter((definition) => {
    const titleMatches = definition.titles.filter((title) => containsTerm(text, title)).length
    const keywordMatches = definition.keywords.filter((keyword) => containsTerm(text, keyword)).length
    return titleMatches >= 1 || keywordMatches >= 2
  }).map((definition) => definition.id)
}

function inferSeniority(text: string): string | null {
  const lower = text.toLowerCase()
  for (let index = SENIORITY_LEVELS.length - 1; index >= 0; index -= 1) {
    const level = SENIORITY_LEVELS[index]
    if (containsTerm(lower, level)) return level
  }
  if (/\bmid[-\s]?level\b/i.test(lower)) return "mid"
  return null
}

function compareSeniority(observed: string | null, expected: string | null): boolean | null {
  if (!observed || !expected) return null
  const observedIndex = SENIORITY_LEVELS.indexOf(observed as (typeof SENIORITY_LEVELS)[number])
  const expectedIndex = SENIORITY_LEVELS.indexOf(expected as (typeof SENIORITY_LEVELS)[number])
  if (observedIndex === -1 || expectedIndex === -1) return null
  return observedIndex >= expectedIndex
}

function analyzeJobDescription(jd: string): JDAnalysis | null {
  const trimmed = normalizeWhitespace(jd)
  if (!trimmed) return null

  const lines = splitLines(trimmed)
  const firstMeaningfulLine =
    lines.find((line) =>
      /(engineer|developer|manager|analyst|scientist|architect|designer|consultant|specialist|administrator|director)/i.test(
        line
      )
    ) || lines[0] || null

  const title = firstMeaningfulLine && firstMeaningfulLine.length <= 140 ? firstMeaningfulLine : null
  const titleTerms = title ? unique([...extractCanonicalTerms(title), ...extractTermsFromLine(title)]).slice(0, 16) : []

  const requiredCounts = new Map<string, number>()
  const preferredCounts = new Map<string, number>()
  const cultureCounts = new Map<string, number>()
  const responsibilityCounts = new Map<string, number>()
  const domainCounts = new Map<string, number>()
  const certificationCounts = new Map<string, number>()
  const seniorityTerms: string[] = []

  for (const line of lines) {
    const lower = line.toLowerCase()
    const extractedTerms = extractTermsFromLine(line)
    const canonicalTerms = extractCanonicalTerms(line)
    const isPreferredLine = PREFERRED_LINE_MARKERS.some((marker) => lower.includes(marker))
    const isRequiredLine = REQUIRED_LINE_MARKERS.some((marker) => lower.includes(marker))
    const isResponsibilityLine = RESPONSIBILITY_LINE_MARKERS.some((marker) => lower.includes(marker))
    const isCultureLine =
      CULTURE_TERMS.some((termValue) => lower.includes(termValue)) ||
      SOFT_SKILL_TERMS.some((termValue) => containsTerm(lower, termValue))

    const domainTerms = extractCanonicalTerms(line, [
      "language",
      "framework",
      "cloud",
      "devops",
      "data",
      "analytics",
      "ai",
      "security",
      "testing",
      "product",
      "design",
      "marketing",
      "sales",
      "finance",
      "operations",
      "customer",
      "compliance",
    ])
    addTermsToMap(domainCounts, domainTerms, isRequiredLine ? 3 : isPreferredLine ? 2 : 1)

    if (isRequiredLine) addTermsToMap(requiredCounts, [...canonicalTerms, ...extractedTerms], 3)
    if (isPreferredLine) addTermsToMap(preferredCounts, [...canonicalTerms, ...extractedTerms], 2)
    if (isResponsibilityLine) addTermsToMap(responsibilityCounts, [...canonicalTerms, ...extractedTerms], 2)
    if (isCultureLine) addTermsToMap(cultureCounts, [...canonicalTerms, ...extractedTerms], 1)

    if (/(certif|certified|license|licence)/i.test(lower)) {
      addTermsToMap(
        certificationCounts,
        [
          ...extractCanonicalTerms(line, ["certification"]),
          ...CERTIFICATION_TERMS.filter((termValue) => lower.includes(termValue.toLowerCase())),
        ],
        isRequiredLine ? 3 : 2
      )
    }

    if (textIncludesAny(lower, [...SENIORITY_LEVELS])) {
      seniorityTerms.push(...SENIORITY_LEVELS.filter((termValue) => containsTerm(lower, termValue)))
    }
  }

  addTermsToMap(requiredCounts, titleTerms, 4)
  addTermsToMap(responsibilityCounts, titleTerms, 2)

  const yearsMatches = [...trimmed.matchAll(/(\d{1,2})\+?\s+years?/gi)].map((match) => Number(match[1]))
  const yearsRequired = yearsMatches.length ? Math.max(...yearsMatches) : null
  const degreeRequirement = extractHighestDegreeRequirement(trimmed)
  const roleFamilies = unique(extractRoleFamilies(trimmed))
  const remoteTerms = REMOTE_TERMS.filter((termValue) => containsTerm(trimmed, termValue))
  const requiresManagement = MANAGEMENT_MARKERS.some((marker) => containsTerm(trimmed, marker))

  const requiredCertifications = unique([
    ...rankMapKeys(certificationCounts, 20),
    ...CERTIFICATION_TERMS.filter((termValue) => containsTerm(trimmed, termValue)),
  ]).slice(0, 20)

  const optionalSections: SectionKey[] = []
  if (requiredCertifications.length > 0 || /(certif|license|licence)/i.test(trimmed)) optionalSections.push("certifications")
  if (/(project|portfolio|github|case study|sample work)/i.test(trimmed)) optionalSections.push("projects")
  if (/(publication|research|paper|patent)/i.test(trimmed)) optionalSections.push("publications")

  return {
    title,
    titleTerms,
    requiredTerms: unique([
      ...rankMapKeys(requiredCounts, 60),
      ...rankMapKeys(responsibilityCounts, 24),
      ...titleTerms,
    ]).slice(0, 60),
    preferredTerms: rankMapKeys(preferredCounts, 35),
    cultureTerms: unique([
      ...rankMapKeys(cultureCounts, 24),
      ...CULTURE_TERMS.filter((termValue) => containsTerm(trimmed, termValue)),
    ]).slice(0, 24),
    responsibilityTerms: rankMapKeys(responsibilityCounts, 30),
    domainTerms: rankMapKeys(domainCounts, 40),
    roleFamilies,
    seniorityTerms: unique(seniorityTerms).slice(0, 6),
    yearsRequired,
    degreeRequirement,
    requiredCertifications,
    requiresManagement,
    remoteTerms,
    optionalSections: unique(optionalSections),
  }
}

function analyzeSkillsSection(skillsText: string): SkillsAnalysis {
  const lines = splitLines(skillsText)
  const rawItems: string[] = []
  const categoryLabels: string[] = []

  for (const line of lines) {
    const cleaned = line.replace(/^[-*•]\s*/, "").trim()
    const categoryMatch = cleaned.match(
      /^(languages?|frameworks?|libraries|tools?|cloud|platforms?|databases?|devops|methodologies|analytics|product|design|marketing|sales|certifications?)\s*:\s*(.+)$/i
    )
    if (categoryMatch) {
      categoryLabels.push(categoryMatch[1].toLowerCase())
      rawItems.push(
        ...categoryMatch[2]
          .split(/[|,;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
      continue
    }

    rawItems.push(
      ...cleaned
        .split(/[|,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  }

  const items = unique(
    rawItems
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter((item) => item.length >= 2)
  )
  const canonicalTerms = extractCanonicalTerms(skillsText)
  const specificTerms = items.filter(
    (item) =>
      extractCanonicalTerms(item).length > 0 ||
      /[A-Z]{2,}|[+#.]|\d/.test(item) ||
      item.split(" ").length >= 2
  ).length
  const genericTerms = items.filter((item) => GENERIC_SKILL_TERMS.has(item.toLowerCase())).length

  return {
    items,
    categoryLabels: unique(categoryLabels),
    canonicalTerms,
    specificTerms,
    genericTerms,
  }
}

function buildResumeLexicalCoverage(
  resumeContent: string,
  sections: Partial<Record<SectionKey, SectionBlock>>
): ResumeLexicalCoverage {
  const sectionTermCoverage: ResumeLexicalCoverage["sectionTermCoverage"] = {
    fullResume: extractCanonicalTerms(resumeContent),
  }

  for (const [key, section] of Object.entries(sections) as Array<[SectionKey, SectionBlock | undefined]>) {
    if (!section) continue
    sectionTermCoverage[key] = extractCanonicalTerms(section.content)
  }

  const allCanonicalTerms = sectionTermCoverage.fullResume || []
  const hardSkills = allCanonicalTerms.filter((termValue) => {
    const category = KEYWORD_GROUP_MAP.get(termValue)?.category
    return Boolean(category && TECHNICAL_CATEGORIES.includes(category))
  })
  const softSkills = allCanonicalTerms.filter((termValue) => KEYWORD_GROUP_MAP.get(termValue)?.category === "soft-skill")
  const certifications = allCanonicalTerms.filter(
    (termValue) => KEYWORD_GROUP_MAP.get(termValue)?.category === "certification"
  )

  return {
    roleFamilies: extractRoleFamilies(resumeContent),
    allCanonicalTerms,
    hardSkills,
    softSkills,
    certifications,
    leadershipSignals: unique(
      ["leadership", "mentorship", "stakeholder management", "program management", "people management"].filter((termValue) =>
        containsTerm(resumeContent, termValue)
      )
    ),
    businessSignals: unique(BUSINESS_IMPACT_TERMS.filter((termValue) => containsTerm(resumeContent, termValue))),
    sectionTermCoverage,
  }
}

function buildKeywordAnalysis(
  jd: JDAnalysis | null,
  resumeContent: string,
  sections: Partial<Record<SectionKey, SectionBlock>>
): KeywordAnalysis | null {
  if (!jd) return null

  const resumeLower = resumeContent.toLowerCase()
  const resumeLines = splitLines(resumeContent)
  const classify = (terms: string[]) => {
    const matched: string[] = []
    const missing: string[] = []
    for (const termValue of terms) {
      const evidence = findTermEvidenceInLines(resumeLines, termValue)
      if (evidence.exact || evidence.semantic) matched.push(resolveCanonicalTerm(termValue))
      else missing.push(resolveCanonicalTerm(termValue))
    }
    return { matched: unique(matched), missing: unique(missing) }
  }

  const title = classify(jd.titleTerms)
  const required = classify(jd.requiredTerms)
  const preferred = classify(jd.preferredTerms)
  const culture = classify(jd.cultureTerms)

  const uniqueTerms = unique([
    ...jd.titleTerms,
    ...jd.requiredTerms,
    ...jd.preferredTerms,
    ...jd.cultureTerms,
  ]).map((termValue) => resolveCanonicalTerm(termValue))
  const matchedUniqueTerms = unique([
    ...title.matched,
    ...required.matched,
    ...preferred.matched,
    ...culture.matched,
  ])

  let weightedTotal = 0
  let weightedMatched = 0
  const weightedTerms = [
    { terms: jd.titleTerms, weight: 6 },
    { terms: jd.requiredTerms, weight: 5 },
    { terms: jd.preferredTerms, weight: 2 },
    { terms: jd.cultureTerms, weight: 1 },
  ]

  for (const group of weightedTerms) {
    for (const termValue of group.terms) {
      weightedTotal += group.weight
      if (containsTerm(resumeLower, termValue)) weightedMatched += group.weight
    }
  }

  const resumeTokens = tokenize(resumeLower)
  const totalTokens = resumeTokens.length || 1
  const matchedTokenOccurrences = matchedUniqueTerms.reduce(
    (sum, termValue) => sum + countOccurrences(resumeLower, termValue),
    0
  )
  const keywordDensity = Number(((matchedTokenOccurrences / totalTokens) * 100).toFixed(1))

  const overusedKeywords = matchedUniqueTerms
    .filter((termValue) => countOccurrences(resumeLower, termValue) >= 7)
    .slice(0, 15)
  const criticalTerms = unique([
    ...jd.titleTerms,
    ...jd.requiredTerms.slice(0, 18),
    ...jd.responsibilityTerms.slice(0, 10),
  ]).map((termValue) => resolveCanonicalTerm(termValue))
  const criticalMatchedTerms = criticalTerms.filter((termValue) => {
    const evidence = findTermEvidenceInLines(resumeLines, termValue)
    return evidence.exact || evidence.semantic
  })
  const criticalMissingTerms = criticalTerms.filter((termValue) => {
    const evidence = findTermEvidenceInLines(resumeLines, termValue)
    return !evidence.exact && !evidence.semantic
  })
  const underusedKeywords = criticalMatchedTerms
    .filter((termValue) => countOccurrences(resumeLower, termValue) === 1)
    .slice(0, 15)

  const sectionText = {
    professionalSummary: getSectionText(sections.professionalSummary).toLowerCase(),
    skills: getSectionText(sections.skills).toLowerCase(),
    workExperience: getSectionText(sections.workExperience).toLowerCase(),
    education: getSectionText(sections.education).toLowerCase(),
    projects: getSectionText(sections.projects).toLowerCase(),
    certifications: getSectionText(sections.certifications).toLowerCase(),
  }

  return {
    totalKeywordsInJD: uniqueTerms.length,
    matchedKeywords: matchedUniqueTerms.length,
    matchPercentage: clamp(weightedTotal > 0 ? (weightedMatched / weightedTotal) * 100 : 0),
    keywordDensity,
    overusedKeywords,
    underusedKeywords,
    matchedByCategory: {
      title: title.matched.slice(0, 15),
      required: required.matched.slice(0, 20),
      preferred: preferred.matched.slice(0, 20),
      culture: culture.matched.slice(0, 15),
    },
    missingByCategory: {
      required: required.missing.slice(0, 20),
      preferred: preferred.missing.slice(0, 20),
    },
    coverageBySection: {
      professionalSummary: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.professionalSummary), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 15),
      skills: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.skills), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 20),
      workExperience: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.workExperience), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 20),
      education: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.education), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 12),
      projects: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.projects), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 15),
      certifications: criticalTerms
        .filter((termValue) => {
          const evidence = findTermEvidenceInLines(splitLines(sectionText.certifications), termValue)
          return evidence.exact || evidence.semantic
        })
        .slice(0, 12),
    },
    criticalMatchedTerms,
    criticalMissingTerms,
  }
}

function scoreProfessionalSummary(summaryText: string, jd: JDAnalysis | null, summaryStats: SummaryStats): number {
  if (!summaryText) return 15

  let score = 25
  if (summaryStats.wordCount >= 25 && summaryStats.wordCount <= 90) score += 10
  else if (summaryStats.wordCount >= 15) score += 5

  if (summaryStats.lineCount >= 3 && summaryStats.lineCount <= 4) score += 12
  else if (summaryStats.lineCount >= 2 && summaryStats.lineCount <= 5) score += 6

  if (summaryStats.hasYears) score += 8
  if (summaryStats.hasMetric) score += 8
  if (summaryStats.hasRoleTitle) score += 8
  if (summaryStats.hasSeniority) score += 5
  if (summaryStats.hasCoreSkills) score += 8
  if (summaryStats.first50KeywordMatches >= 3) score += 10
  else if (summaryStats.first50KeywordMatches >= 1) score += 5
  if (summaryStats.matchedCriticalTerms >= 4) score += 10
  else if (summaryStats.matchedCriticalTerms >= 2) score += 5
  if (jd?.titleTerms.some((termValue) => containsTerm(summaryText, termValue))) score += 6
  if (summaryStats.hasObjectiveLanguage) score -= 8
  if (summaryStats.firstPerson) score -= 10

  return clamp(score)
}

function scoreSkills(skillsText: string, jd: JDAnalysis | null, skillsAnalysis: SkillsAnalysis): number {
  if (!skillsText) return 15

  let score = 25
  if (skillsAnalysis.items.length >= 15 && skillsAnalysis.items.length <= 25) score += 15
  else if (skillsAnalysis.items.length >= 10) score += 10
  else if (skillsAnalysis.items.length >= 5) score += 5

  if (skillsAnalysis.categoryLabels.length >= 3) score += 15
  else if (skillsAnalysis.categoryLabels.length >= 2) score += 8

  const specificityRatio = skillsAnalysis.items.length > 0 ? skillsAnalysis.specificTerms / skillsAnalysis.items.length : 0
  if (specificityRatio >= 0.6) score += 15
  else if (specificityRatio >= 0.4) score += 8

  if (skillsAnalysis.canonicalTerms.length >= 10) score += 10
  else if (skillsAnalysis.canonicalTerms.length >= 6) score += 5

  if (jd?.requiredTerms.length) {
    const matched = jd.requiredTerms.filter((termValue) => containsTerm(skillsText, termValue)).length
    score += Math.min(20, matched * 2)
  }
  if (jd?.titleTerms.some((termValue) => containsTerm(skillsText, termValue))) score += 5
  if (skillsAnalysis.genericTerms > Math.max(2, Math.floor(skillsAnalysis.items.length * 0.35))) score -= 6

  return clamp(score)
}

function scoreContentQuality(
  bulletStats: BulletStats,
  repetition: RepetitionStats,
  lexicalCoverage: ResumeLexicalCoverage
): number {
  if (bulletStats.total === 0) return 25

  const quantifiedRatio = bulletStats.quantified / bulletStats.total
  const strongVerbRatio = bulletStats.strongVerb / bulletStats.total
  const weakVerbRatio = bulletStats.weakVerb / bulletStats.total
  const starRatio = bulletStats.starLike / bulletStats.total
  const timeframeRatio = bulletStats.timeframeMentioned / bulletStats.total
  const technicalRatio = bulletStats.technicalSpecificity / bulletStats.total
  const passiveRatio = bulletStats.passiveVoice / bulletStats.total
  const firstPersonRatio = bulletStats.firstPerson / bulletStats.total
  const businessRatio = bulletStats.businessImpact / bulletStats.total
  const scopeRatio = bulletStats.scopeMentioned / bulletStats.total
  const toolRatio = bulletStats.toolMentioned / bulletStats.total
  const shortPenalty = Math.min(1, bulletStats.tooShort / Math.max(1, bulletStats.total))
  const longPenalty = Math.min(1, bulletStats.tooLong / Math.max(1, bulletStats.total))
  const repetitionPenalty = Math.min(1, repetition.repeatedContentWords.length / 8)
  const phrasePenalty = Math.min(1, repetition.repeatedPhrases.length / 6)
  const duplicatePenalty = Math.min(1, bulletStats.duplicateBullets / Math.max(1, bulletStats.total))
  const lengthScore =
    bulletStats.averageWordCount >= 12 && bulletStats.averageWordCount <= 28
      ? 1
      : bulletStats.averageWordCount >= 10 && bulletStats.averageWordCount <= 32
        ? 0.7
        : 0.4

  const score =
    quantifiedRatio * 20 +
    strongVerbRatio * 12 +
    starRatio * 14 +
    timeframeRatio * 6 +
    technicalRatio * 8 +
    businessRatio * 10 +
    scopeRatio * 8 +
    toolRatio * 8 +
    (1 - Math.min(1, weakVerbRatio)) * 5 +
    (1 - Math.min(1, passiveRatio)) * 4 +
    (1 - Math.min(1, firstPersonRatio)) * 4 +
    lengthScore * 6 +
    (1 - shortPenalty) * 3 +
    (1 - longPenalty) * 3 -
    repetitionPenalty * 4 -
    phrasePenalty * 4 -
    duplicatePenalty * 6 +
    Math.min(4, lexicalCoverage.hardSkills.length * 0.25) +
    Math.min(3, lexicalCoverage.businessSignals.length * 0.6)

  return clamp(score)
}

function scoreFormatting(
  sections: Partial<Record<SectionKey, SectionBlock>>,
  contact: ContactInfo,
  dates: DateInfo,
  text: string,
  bulletStats: BulletStats,
  structureSignals?: DocumentStructureSignals
): { score: number; parseability: number; issues: string[]; warnings: string[] } {
  const issues: string[] = []
  const warnings: string[] = []
  let score = 100
  const parseRisk = computeDocumentParseRisk(text)

  if (!contact.email) {
    score -= 18
    issues.push("Email address was not detected in the main resume body.")
  }

  if (!contact.phone) {
    score -= 15
    issues.push("Phone number was not detected in the main resume body.")
  }

  if (!contact.location) {
    score -= 4
    warnings.push("Location was not detected near the top of the resume.")
  }

  if (!contact.professionalEmail && contact.email) {
    score -= 3
    warnings.push("Email format may look informal for professional use.")
  }

  for (const sectionKey of REQUIRED_SECTION_KEYS) {
    if (!sections[sectionKey]) {
      score -= 8
      warnings.push(`Missing standard ATS section header for ${titleCase(sectionKey)}.`)
    }
  }

  if (!dates.consistent && dates.formats.length > 1) {
    score -= 10
    warnings.push("Date formatting is inconsistent across the resume.")
  }

  if (dates.futureDates.length > 0) {
    score -= 8
    issues.push(`Detected date(s) after March 8, 2026: ${dates.futureDates.join(", ")}.`)
  }

  if (/[★♦►■▪◇◆]/.test(text)) {
    score -= 5
    warnings.push("Special characters may reduce ATS parsing reliability.")
  }

  if ((text.match(/\|/g) || []).length >= 12) {
    score -= 4
    warnings.push("Heavy use of inline separators may indicate formatting that parses inconsistently.")
  }

  if (!bulletStats.consistentMarkers && bulletStats.total > 2) {
    score -= 4
    warnings.push("Bullet formatting appears inconsistent across achievement lines.")
  }

  if (!sections.workExperience) {
    score -= 12
    issues.push("Work experience section was not detected with a standard ATS-safe header.")
  }

  if (structureSignals?.hasTableEvidence) {
    score -= 8
    issues.push("Structured extraction found table-like layout evidence that can reduce ATS field parsing reliability.")
  }

  if (structureSignals?.hasMultiColumnEvidence) {
    score -= 10
    issues.push("Structured extraction found likely multi-column layout, which often breaks ATS reading order.")
  }

  if ((structureSignals?.readingOrderRisk || 0) >= 0.2) {
    score -= 8
    warnings.push("Structured extraction suggests unstable reading order across parts of the document.")
  } else if ((structureSignals?.readingOrderRisk || 0) >= 0.1) {
    score -= 4
    warnings.push("Structured extraction suggests mild reading-order risk.")
  }

  if (structureSignals?.contactInHeaderFooter) {
    score -= 6
    warnings.push("Contact details appear to rely on header or footer regions, which some ATS parsers ignore.")
  }

  if (contact.url && !contact.linkedin && !contact.github) {
    score -= 2
    warnings.push("A URL was detected but it does not clearly identify LinkedIn, GitHub, or a portfolio.")
  }

  if (parseRisk.riskPenalty > 0) {
    score -= parseRisk.riskPenalty
    issues.push(...parseRisk.issues)
    warnings.push(...parseRisk.warnings)
  }

  const parseability = clamp(score)
  return {
    score: parseability,
    parseability,
    issues: issues.slice(0, 6),
    warnings: warnings.slice(0, 6),
  }
}

function scoreStructure(
  sections: Partial<Record<SectionKey, SectionBlock>>,
  order: string[],
  contact: ContactInfo,
  summaryStats: SummaryStats,
  skillsAnalysis: SkillsAnalysis,
  jd: JDAnalysis | null,
  structureSignals?: DocumentStructureSignals
): number {
  let score = 25
  const requiredPresent = REQUIRED_SECTION_KEYS.filter((key) => sections[key]).length
  score += (requiredPresent / REQUIRED_SECTION_KEYS.length) * 35
  const artifactDetected = structureSignals?.detectedSections.length || 0
  if (artifactDetected > requiredPresent) {
    score += Math.min(6, (artifactDetected - requiredPresent) * 2)
  }

  if (contact.email && contact.phone && contact.location) score += 10
  else if (contact.email && contact.phone) score += 7

  if (sections.professionalSummary && summaryStats.lineCount >= 3 && summaryStats.lineCount <= 4) score += 6
  else if (sections.professionalSummary) score += 3

  if (sections.skills) score += 5
  if (sections.workExperience && sections.education) score += 6
  if (skillsAnalysis.items.length >= 15 && skillsAnalysis.items.length <= 25) score += 5

  const preferredOrder = ["professionalSummary", "skills", "workExperience", "education"]
  const orderScore = preferredOrder.every((key, index) => {
    const actualIndex = order.indexOf(key)
    return actualIndex === -1 || actualIndex >= index
  })
  if (orderScore) score += 5

  if (jd?.optionalSections.includes("certifications")) {
    score += sections.certifications ? 4 : -6
  }
  if (jd?.optionalSections.includes("projects")) {
    score += sections.projects ? 3 : -2
  }

  if (structureSignals?.hasMultiColumnEvidence) score -= 6
  if ((structureSignals?.readingOrderRisk || 0) >= 0.2) score -= 4

  return clamp(score)
}

function scoreEducation(educationText: string, jd: JDAnalysis | null): number {
  if (!educationText) return jd?.degreeRequirement ? 20 : 40

  let score = 45
  if (/\b(university|college|institute|school|academy)\b/i.test(educationText)) score += 15
  if (/\b(bachelor|master|mba|phd|doctorate|bs|ba|ms|b\.s|m\.s|associate)\b/i.test(educationText)) score += 15
  if (/(\b(19|20)\d{2}\b|\b(0?[1-9]|1[0-2])\/(19|20)\d{2}\b)/.test(educationText)) score += 10
  if (/\b(gpa|honors|dean's list|distinction|cum laude)\b/i.test(educationText)) score += 5

  const degreeRequirementMet = hasDegree(educationText, jd?.degreeRequirement || null)
  if (degreeRequirementMet === true) score += 8
  if (degreeRequirementMet === false) score -= 18

  return clamp(score)
}

function scoreKeywordMatch(
  keywordAnalysis: KeywordAnalysis | null,
  jd: JDAnalysis | null,
  lexicalCoverage: ResumeLexicalCoverage
): number {
  if (!keywordAnalysis || !jd) return 0

  const densityScore =
    keywordAnalysis.keywordDensity >= 1.5 && keywordAnalysis.keywordDensity <= 4.5
      ? 12
      : keywordAnalysis.keywordDensity > 0.75
        ? 6
        : 2
  const placementScore = Math.min(
    26,
    keywordAnalysis.coverageBySection.professionalSummary.length * 3 +
      keywordAnalysis.coverageBySection.skills.length * 1.5 +
      keywordAnalysis.coverageBySection.workExperience.length * 1.2 +
      keywordAnalysis.coverageBySection.projects.length * 1 +
      keywordAnalysis.coverageBySection.certifications.length * 0.8
  )
  const titleScore = Math.min(8, keywordAnalysis.matchedByCategory.title.length * 2)
  const roleFamilyOverlap = jd.roleFamilies.filter((family) => lexicalCoverage.roleFamilies.includes(family)).length
  const roleFamilyScore = jd.roleFamilies.length > 0 ? Math.min(10, roleFamilyOverlap * 4) : 5
  const criticalPenalty = Math.min(10, keywordAnalysis.criticalMissingTerms.length * 0.7)

  return clamp(keywordAnalysis.matchPercentage * 0.62 + densityScore + placementScore + titleScore + roleFamilyScore - criticalPenalty)
}

function inferQualificationAlignment(
  jd: JDAnalysis | null,
  educationText: string,
  dates: DateInfo,
  resumeContent: string,
  lexicalCoverage: ResumeLexicalCoverage,
  summaryText: string,
  experienceText: string
): QualificationAlignment {
  const yearsRequired = jd?.yearsRequired ?? null
  const yearsEstimated = dates.yearsEstimated
  const meetsYearsRequirement =
    yearsRequired !== null && yearsEstimated !== null ? yearsEstimated >= yearsRequired : null
  const degreeRequirement = jd?.degreeRequirement ?? null
  const meetsDegreeRequirement = hasDegree(educationText, degreeRequirement)
  const missingCertifications = (jd?.requiredCertifications || []).filter(
    (certification) => !containsTerm(resumeContent, certification)
  )

  const expectedSeniority = inferSeniority([...(jd?.seniorityTerms || []), jd?.title || ""].join(" "))
  const observedSeniority = inferSeniority(`${summaryText}\n${experienceText}\n${resumeContent}`)
  const seniorityAligned = compareSeniority(observedSeniority, expectedSeniority)

  const managementRequired = jd?.requiresManagement ?? false
  const managementObserved =
    MANAGEMENT_MARKERS.some((marker) => containsTerm(resumeContent, marker)) ||
    /\bmanaged\s+(?:a|an|the)?\s*\d+/i.test(resumeContent) ||
    /\bmentored\b/i.test(resumeContent) ||
    /\b(?:direct reports?|managed|led)\s+(?:a\s+)?team of\s+\d+/i.test(resumeContent)

  const matchedRoleFamilies = (jd?.roleFamilies || []).filter((family) =>
    lexicalCoverage.roleFamilies.includes(family)
  )

  const summarySignals = splitLines(summaryText)
  const experienceSignals = splitLines(experienceText)
  const seniorityEvidenceBoost =
    (summarySignals.some((line) => /\b(lead|staff|principal|head|director)\b/i.test(line)) ? 1 : 0) +
    (experienceSignals.some((line) => /\b(lead|managed|mentored|owned|drove)\b/i.test(line)) ? 1 : 0)

  let score = 68
  if (yearsRequired !== null) {
    if (meetsYearsRequirement === true) score += 14
    else if (meetsYearsRequirement === false) score -= yearsRequired >= 8 ? 24 : 20
  }

  if (degreeRequirement) {
    if (meetsDegreeRequirement === true) score += 8
    else if (meetsDegreeRequirement === false) score -= 14
  }

  if (missingCertifications.length > 0) score -= Math.min(15, missingCertifications.length * 7)
  if (seniorityAligned === true) score += 8 + Math.min(3, seniorityEvidenceBoost)
  else if (seniorityAligned === false) score -= 10
  if (managementRequired) score += managementObserved ? 6 : -8
  if (jd?.roleFamilies.length) score += Math.min(10, matchedRoleFamilies.length * 4)

  return {
    score: clamp(score),
    yearsRequired,
    yearsEstimated,
    meetsYearsRequirement,
    degreeRequirement,
    meetsDegreeRequirement,
    requiredCertifications: jd?.requiredCertifications || [],
    missingCertifications,
    expectedSeniority,
    observedSeniority,
    seniorityAligned,
    managementRequired,
    managementObserved,
    matchedRoleFamilies,
  }
}

function calibrateScores(params: {
  hasJD: boolean
  jdAnalysis: JDAnalysis | null
  formattingScore: number
  contentQualityScore: number
  summaryScore: number
  skillsScore: number
  structureScore: number
  educationScore: number
  keywordScore: number | null
  qualificationScore: number
  missingRequiredSectionCount: number
  contact: ContactInfo
  qualification: QualificationAlignment
}): { resumeQualityScore: number; targetRoleScore: number | null; overallScore: number } {
  const {
    hasJD,
    jdAnalysis,
    formattingScore,
    contentQualityScore,
    summaryScore,
    skillsScore,
    structureScore,
    educationScore,
    keywordScore,
    qualificationScore,
    missingRequiredSectionCount,
    contact,
    qualification,
  } = params

  const resumeQualityScore = clamp(
    formattingScore * 0.24 +
      contentQualityScore * 0.27 +
      summaryScore * 0.13 +
      skillsScore * 0.14 +
      structureScore * 0.12 +
      educationScore * 0.10 -
      missingRequiredSectionCount * 2
  )

  const jdSignalStrength = Math.min(
    1,
    ((jdAnalysis?.requiredTerms.length || 0) + (jdAnalysis?.titleTerms.length || 0) * 1.5) / 18
  )
  const keywordWeight = 0.26 + jdSignalStrength * 0.10
  const qualificationWeight = 0.20 + (qualification.yearsRequired !== null || qualification.degreeRequirement ? 0.06 : 0)
  const contentWeight = 0.12
  const skillsWeight = 0.11
  const summaryWeight = 0.12
  const formattingWeight = 0.08
  const educationWeight = 0.06

  const targetRoleScore = hasJD
    ? clamp(
        (keywordScore || 0) * keywordWeight +
          qualificationScore * qualificationWeight +
          summaryScore * summaryWeight +
          skillsScore * skillsWeight +
          contentQualityScore * contentWeight +
          formattingScore * formattingWeight +
          educationScore * educationWeight
      )
    : null

  let overallScore = hasJD ? clamp(resumeQualityScore * 0.35 + (targetRoleScore || 0) * 0.65) : resumeQualityScore

  const severeParseability = formattingScore < 55
  const missingCoreContact = !contact.email || !contact.phone
  const failedYearsGate = qualification.meetsYearsRequirement === false && (keywordScore || 0) < 55
  const missingCriticalEvidence = missingRequiredSectionCount >= 2

  if (severeParseability) overallScore = Math.min(overallScore, 58)
  if (missingCoreContact && missingCriticalEvidence) overallScore = Math.min(overallScore, 50)
  if (failedYearsGate) overallScore = Math.min(overallScore, 57)
  if (qualification.missingCertifications.length >= 2) overallScore = Math.min(overallScore, 62)

  return {
    resumeQualityScore,
    targetRoleScore,
    overallScore: clamp(overallScore),
  }
}

function buildIssuesAndRecommendations(params: {
  hasJD: boolean
  formattingScore: number
  structureScore: number
  summaryScore: number
  summaryStats: SummaryStats
  skillsScore: number
  skillsAnalysis: SkillsAnalysis
  contentScore: number
  keywordScore: number | null
  educationScore: number
  bulletStats: BulletStats
  repetition: RepetitionStats
  qualification: QualificationAlignment
  keywordAnalysis: KeywordAnalysis | null
  lexicalCoverage: ResumeLexicalCoverage
  contact: ContactInfo
  dates: DateInfo
  missingSections: string[]
  missingOptionalSections: string[]
}): {
  issues: ATSIssue[]
  recommendations: ATSRecommendation[]
  strengths: string[]
  weaknesses: string[]
} {
  const issues: ATSIssue[] = []
  const recommendations: ATSRecommendation[] = []
  const strengths: string[] = []
  const weaknesses: string[] = []

  const pushIssue = (issue: ATSIssue) => issues.push(issue)
  const pushRecommendation = (recommendation: ATSRecommendation) => recommendations.push(recommendation)
  const pushStrength = (value: string) => strengths.push(value)
  const pushWeakness = (value: string) => weaknesses.push(value)

  if (params.contact.email && params.contact.phone) {
    pushStrength("Core contact information is present in the resume body, which supports ATS parsing.")
  } else {
    pushWeakness("Contact information is incomplete in the main resume body.")
  }

  if (params.bulletStats.total > 0 && params.bulletStats.quantified / params.bulletStats.total >= 0.6) {
    pushStrength("Experience bullets include measurable outcomes in a majority of cases.")
  }

  if (params.bulletStats.businessImpact / Math.max(1, params.bulletStats.total) >= 0.4) {
    pushStrength("Experience bullets connect work to business or customer impact often enough to strengthen credibility.")
  }

  if (params.skillsScore >= 75) {
    pushStrength("The skills section is specific enough to support ATS keyword retrieval.")
  }

  if (params.summaryScore >= 75) {
    pushStrength("The professional summary provides a strong ATS entry point near the top of the resume.")
  }

  if (params.hasJD && params.keywordScore !== null && params.keywordScore >= 75) {
    pushStrength("Job-description keyword coverage is strong across core resume sections.")
  }

  if (params.hasJD && params.qualification.matchedRoleFamilies.length > 0) {
    pushStrength("The resume language aligns with the role family implied by the target job description.")
  }

  if (params.missingSections.length > 0) {
    pushIssue({
      severity: "high",
      category: "Structure",
      issue: `Missing ATS-critical section(s): ${params.missingSections.join(", ")}`,
      impact: "Missing standard sections weakens parsing confidence and recruiter scanability.",
      howToFix: "Add standard headers for Professional Summary, Work Experience, Education, and Skills using ATS-safe naming.",
      example: "PROFESSIONAL SUMMARY\nTECHNICAL SKILLS\nWORK EXPERIENCE\nEDUCATION",
    })
    pushRecommendation({
      priority: "high",
      action: "Restore standard ATS section headers",
      benefit: "Improves parse reliability and makes the resume easier to screen quickly.",
      implementation: "Use exact section labels such as PROFESSIONAL SUMMARY, WORK EXPERIENCE, EDUCATION, and TECHNICAL SKILLS.",
    })
    pushWeakness("One or more ATS-standard sections are missing or not clearly labeled.")
  }

  if (!params.contact.email || !params.contact.phone) {
    pushIssue({
      severity: "critical",
      category: "Parseability",
      issue: "Essential contact information is incomplete",
      impact: "ATS platforms and recruiters may not be able to identify or contact the candidate reliably.",
      howToFix: "Place email and phone number in plain text near the top of the resume body.",
      example: "name@email.com | +1 555-555-5555 | City, ST | linkedin.com/in/name",
    })
    pushRecommendation({
      priority: "high",
      action: "Add missing contact details to the top of the resume",
      benefit: "Prevents ATS parsing failures and removes a basic screening blocker.",
      implementation: "Use plain-text email and phone on the first lines of the resume, not inside design elements.",
    })
  }

  if (params.formattingScore < 70) {
    pushWeakness("Parseability signals are weaker than they should be for an ATS-safe resume.")
  }

  if (params.hasJD && params.keywordScore !== null && params.keywordScore < 65) {
    const missing = params.keywordAnalysis?.criticalMissingTerms.slice(0, 6) || []
    pushIssue({
      severity: "high",
      category: "Keyword Match",
      issue: "The resume misses a material portion of the job's critical terminology",
      impact: "Lower keyword coverage reduces ranking in ATS search, filters, and recruiter review.",
      howToFix: "Add missing required terms where they are truthfully supported, especially in the summary, skills section, and most recent role.",
      example: missing.length
        ? `Add supported keywords such as: ${missing.join(", ")}`
        : "Mirror the job's top required skills using exact supported wording.",
    })
    pushRecommendation({
      priority: "high",
      action: "Increase exact keyword alignment with the job description",
      benefit: "Raises role-fit score and improves visibility in recruiter searches.",
      implementation: "Place supported required terms in the summary, skills section, and first bullet of the most recent role.",
    })
    pushWeakness("Required keyword coverage is below the level expected for a strong role match.")
  }

  if (
    params.hasJD &&
    params.keywordAnalysis &&
    params.qualification.matchedRoleFamilies.length === 0 &&
    params.keywordAnalysis.criticalMissingTerms.length >= 6
  ) {
    pushIssue({
      severity: "high",
      category: "Role Alignment",
      issue: "The resume reads like a weak match for the target role family",
      impact: "ATS and recruiter review may rank the document lower when core role signals are thin or misplaced.",
      howToFix: "Reposition the resume around the target role's core tools, responsibilities, and title language where accurate.",
      example: "For a backend role, surface API, distributed systems, cloud, databases, and performance work in the summary, skills, and recent bullets.",
    })
    pushRecommendation({
      priority: "high",
      action: "Reframe the resume around the target role family",
      benefit: "Improves title alignment and increases the share of relevant evidence that ATS systems can detect.",
      implementation: "Use role-specific title language in the summary and prioritize the most relevant experience bullets first.",
    })
    pushWeakness("The resume does not yet project a clear role-family match for the target job.")
  }

  if (params.bulletStats.total === 0 || params.contentScore < 65) {
    pushIssue({
      severity: "high",
      category: "Achievement Quality",
      issue: "Experience bullets are not consistently quantified or action-driven",
      impact: "Vague bullets weaken ATS scoring and reduce recruiter confidence in impact.",
      howToFix: "Rewrite bullets using action + how + quantified result + timeframe.",
      example: "Optimized deployment pipeline using GitHub Actions and Docker, reducing release time by 42% and cutting rollback incidents by 60% over 2 quarters.",
    })
    pushRecommendation({
      priority: "high",
      action: "Rewrite weak bullets with metrics and stronger verbs",
      benefit: "Improves achievement quality, recruiter trust, and ATS evidence strength.",
      implementation: "Target at least one concrete metric in every major experience bullet and start with a strong accomplishment verb.",
    })
    pushWeakness("Achievement bullets do not consistently show quantified impact.")
  }

  if (params.bulletStats.passiveVoice / Math.max(1, params.bulletStats.total) >= 0.25) {
    pushIssue({
      severity: "medium",
      category: "Bullet Wording",
      issue: "Too many bullets read in passive or indirect language",
      impact: "Passive phrasing weakens ownership signals and makes accomplishments harder to scan quickly.",
      howToFix: "Start bullets with direct accomplishment verbs and remove passive constructions where accurate.",
      example: "Built customer-facing reporting workflow that reduced weekly manual analysis time by 11 hours.",
    })
  }

  if (params.bulletStats.duplicateBullets > 0 || params.repetition.duplicateBulletFragments.length > 0) {
    pushIssue({
      severity: "medium",
      category: "Repetition",
      issue: "Several bullets reuse near-duplicate wording or structures",
      impact: "Repeated phrasing makes achievements feel templated and lowers perceived depth of experience.",
      howToFix: "Consolidate overlapping bullets and rewrite the remaining bullets around distinct outcomes, scope, or tools.",
      example: "Replace repeated 'Managed project delivery' bullets with separate bullets for planning, execution, and results.",
    })
  }

  if (params.bulletStats.starLike / Math.max(1, params.bulletStats.total) < 0.4) {
    pushIssue({
      severity: "medium",
      category: "STAR Structure",
      issue: "Too few bullets follow a strong action-result or STAR-like pattern",
      impact: "Weak story structure lowers the resume's evidence quality and makes achievements harder to verify quickly.",
      howToFix: "Rewrite bullets to include context, action, quantified result, and timeframe when available.",
      example: "Led API migration across 5 services using Node.js and AWS Lambda, cutting response time by 31% and support tickets by 22% over 4 months.",
    })
    pushRecommendation({
      priority: "medium",
      action: "Improve bullet structure with stronger STAR-style phrasing",
      benefit: "Raises evidence quality and makes achievements easier to parse quickly.",
      implementation: "For major bullets, include the challenge, what you did, how you did it, the measurable result, and the timeframe.",
    })
  }

  if (params.summaryScore < 65) {
    pushIssue({
      severity: "medium",
      category: "Professional Summary",
      issue: "The summary is missing ATS-critical positioning signals",
      impact: "A weak opening reduces keyword visibility and delays fit recognition.",
      howToFix: "Use a summary that names the target role, years of experience, a quantified highlight, and core skills.",
      example: "Software Engineer with 6+ years of experience building cloud-native platforms. Delivered services supporting 2M+ users with 99.9% uptime. Expert in Python, AWS, Kubernetes, Terraform, and CI/CD.",
    })
    pushRecommendation({
      priority: "medium",
      action: "Rebuild the professional summary",
      benefit: "Improves first-pass keyword visibility and role positioning.",
      implementation: "Use 3 to 4 lines: title, years, quantified outcome, and top supported skills from the role.",
    })
    pushWeakness("The summary does not yet provide a strong role-specific ATS signal.")
  }

  if (params.summaryStats.hasObjectiveLanguage) {
    pushIssue({
      severity: "low",
      category: "Professional Summary",
      issue: "The summary leans on objective-style phrasing instead of value-focused positioning",
      impact: "Objective language uses space without adding much ATS or recruiter value.",
      howToFix: "Replace job-seeker wording with concrete role, experience, skill, and impact language.",
      example: "Replace 'Seeking a challenging role' with 'Senior Data Analyst with 7+ years of experience driving KPI reporting and experimentation strategy.'",
    })
  }

  if (params.skillsScore < 65) {
    pushIssue({
      severity: "medium",
      category: "Skills",
      issue: "The skills section lacks enough structure or technical granularity",
      impact: "Generic or thin skills sections lower keyword match quality and recruiter confidence.",
      howToFix: "Group skills by category and use exact tools, services, frameworks, and platforms.",
      example: "Languages: Python, TypeScript, SQL | Cloud: AWS, Lambda, ECS, S3 | DevOps: Docker, Terraform, GitHub Actions",
    })
    pushRecommendation({
      priority: "medium",
      action: "Make the skills section more granular",
      benefit: "Improves exact-match retrieval for ATS queries and recruiter keyword search.",
      implementation: "Break skills into categories such as Languages, Cloud, Frameworks, Databases, and Tools.",
    })
    pushWeakness("The skills section is not yet specific enough for strong ATS retrieval.")
  }

  if (params.skillsAnalysis.items.length > 0 && (params.skillsAnalysis.items.length < 15 || params.skillsAnalysis.items.length > 25)) {
    pushIssue({
      severity: "low",
      category: "Skills",
      issue: "The skills section is outside the recommended ATS-friendly range",
      impact: "Too few skills limit keyword coverage; too many can make the section noisy and unfocused.",
      howToFix: "Aim for about 15 to 25 targeted skills grouped by category.",
      example: "Languages: Python, TypeScript, SQL | Cloud: AWS, Lambda, ECS, S3 | Data: PostgreSQL, Redis, Kafka",
    })
  }

  if (!params.dates.consistent && params.dates.formats.length > 1) {
    pushIssue({
      severity: "medium",
      category: "Dates",
      issue: "Date formatting is inconsistent",
      impact: "Inconsistent dates make ATS parsing and recruiter review slower and less reliable.",
      howToFix: "Use one format throughout the resume, preferably MM/YYYY or Mon YYYY.",
      example: "01/2022 - 08/2024",
    })
    pushRecommendation({
      priority: "medium",
      action: "Standardize all date formats",
      benefit: "Improves parsing consistency and timeline readability.",
      implementation: "Pick one date style and apply it across education, certifications, and every role.",
    })
  }

  if (params.keywordAnalysis && (params.keywordAnalysis.keywordDensity < 1.5 || params.keywordAnalysis.keywordDensity > 4.5)) {
    pushIssue({
      severity: "low",
      category: "Keyword Density",
      issue: "Keyword density sits outside the recommended ATS target range",
      impact: "Very low density weakens role alignment, while very high density can feel stuffed and repetitive.",
      howToFix: "Keep supported keywords distributed naturally across summary, skills, and recent experience.",
      example: "Add supported required terms to the summary and first recent-role bullet instead of repeating the same word throughout the resume.",
    })
  }

  if (params.repetition.repeatedContentWords.length > 0 || params.repetition.repeatedPhrases.length > 0) {
    const repeated = [
      ...params.repetition.repeatedContentWords.slice(0, 3),
      ...params.repetition.repeatedPhrases.slice(0, 2),
    ]
    pushIssue({
      severity: "low",
      category: "Repetition",
      issue: `Repeated wording reduces writing precision: ${repeated.join(", ")}`,
      impact: "Heavy repetition makes the resume feel less precise and can reduce perceived writing quality.",
      howToFix: "Vary word choice and replace repeated generic wording with more specific technical or business terms.",
      example: "Replace repeated words like 'developed' or 'managed' with more specific alternatives such as architected, implemented, optimized, or automated where accurate.",
    })
  }

  if (params.bulletStats.repeatedLeadVerbs.length > 0) {
    pushIssue({
      severity: "low",
      category: "Action Verbs",
      issue: `Repeated lead verbs weaken bullet variety: ${params.bulletStats.repeatedLeadVerbs.join(", ")}`,
      impact: "Repeated opening verbs make experience read as templated rather than accomplishment-driven.",
      howToFix: "Vary lead verbs while keeping them accurate to the actual achievement.",
      example: "Use a mix of Led, Built, Optimized, Implemented, Reduced, Automated, and Delivered where truthful.",
    })
  }

  if (params.qualification.meetsYearsRequirement === false) {
    pushIssue({
      severity: "high",
      category: "Qualification Alignment",
      issue: "Estimated experience appears below the job's stated years requirement",
      impact: "This can lower role-fit ranking for ATS filters and recruiter shortlist review.",
      howToFix: "Emphasize the most relevant tenure and scope, but do not overstate years of experience.",
      example: `Role asks for ${params.qualification.yearsRequired}+ years; resume evidence currently supports about ${params.qualification.yearsEstimated ?? 0} years.`,
    })
    pushWeakness("Experience duration appears below the stated requirement in the job description.")
  }

  if (params.qualification.seniorityAligned === false) {
    pushIssue({
      severity: "medium",
      category: "Seniority Alignment",
      issue: "Resume seniority signals appear lighter than the target role level",
      impact: "Recruiters may not quickly see the leadership, ownership, or scope expected for the role.",
      howToFix: "Highlight the highest-level responsibilities you actually held, including scope, team influence, and decision-making.",
      example: `Target role appears to be ${params.qualification.expectedSeniority}; resume currently reads closer to ${params.qualification.observedSeniority ?? "an unspecified level"}.`,
    })
  }

  if (params.qualification.managementRequired && !params.qualification.managementObserved) {
    pushIssue({
      severity: "high",
      category: "Leadership Alignment",
      issue: "The job appears to require management or mentorship signals that the resume does not clearly show",
      impact: "Leadership-screening filters may score the resume below roles that emphasize people or cross-functional leadership.",
      howToFix: "Surface team leadership, mentoring, hiring, planning, or stakeholder ownership examples if they are true.",
      example: "Led cross-functional team of 9 engineers and designers to launch platform migration 6 weeks ahead of schedule.",
    })
  }

  if (params.qualification.meetsDegreeRequirement === false) {
    pushIssue({
      severity: "medium",
      category: "Education",
      issue: "The education section does not clearly show the degree level requested in the job description",
      impact: "Recruiters may not be able to confirm minimum education requirements quickly.",
      howToFix: "State the degree, institution, and completion date clearly in the education section.",
      example: "M.S. in Computer Science, University Name, 08/2025",
    })
    pushWeakness("The required degree level is not clearly evidenced in the education section.")
  }

  if (params.qualification.missingCertifications.length > 0) {
    pushIssue({
      severity: "medium",
      category: "Certifications",
      issue: `Required certification(s) not found: ${params.qualification.missingCertifications.join(", ")}`,
      impact: "Missing certifications can reduce role alignment when they are used as screening criteria.",
      howToFix: "Add the certification only if it has been earned, or avoid implying it if not held.",
      example: params.qualification.missingCertifications.join(", "),
    })
    if (params.missingOptionalSections.includes("Certifications")) {
      pushRecommendation({
        priority: "medium",
        action: "Add a dedicated certifications section if relevant certifications exist",
        benefit: "Makes credential screening faster for ATS and recruiter review.",
        implementation: "Use a CERTIFICATIONS header and list each certification in plain text with issuing organization and year if available.",
      })
    }
  }

  if (params.missingOptionalSections.length > 0 && params.hasJD) {
    pushWeakness(`Optional role-relevant section(s) are missing: ${params.missingOptionalSections.join(", ")}.`)
  }

  const severityOrder: Record<ATSIssue["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  const priorityOrder: Record<ATSRecommendation["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  const dedupedIssues = unique(issues.map((issue) => JSON.stringify(issue)))
    .map((raw) => JSON.parse(raw) as ATSIssue)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 8)
  const dedupedRecommendations = unique(recommendations.map((recommendation) => JSON.stringify(recommendation)))
    .map((raw) => JSON.parse(raw) as ATSRecommendation)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 6)

  return {
    issues: dedupedIssues,
    recommendations: dedupedRecommendations,
    strengths: unique(strengths).slice(0, 6),
    weaknesses: unique(weaknesses).slice(0, 6),
  }
}

function buildSectionReviews(params: {
  hasJD: boolean
  summaryScore: number
  contentScore: number
  skillsScore: number
  educationScore: number
  formattingScore: number
  keywordScore: number | null
  structureScore: number
  bulletStats: BulletStats
  summaryStats: SummaryStats
  repetition: RepetitionStats
  skillsAnalysis: SkillsAnalysis
  keywordAnalysis: KeywordAnalysis | null
  qualification: QualificationAlignment
}): ATSSectionReview[] {
  const keywordReviewScore = params.hasJD
    ? params.keywordScore ?? 0
    : round(params.skillsScore * 0.4 + params.summaryScore * 0.2 + params.contentScore * 0.4)

  return [
    {
      id: "professionalSummary",
      title: "Professional Summary",
      score: params.summaryScore,
      status: classifyStatus(params.summaryScore),
      diagnosis:
        params.summaryScore >= 75
          ? "The summary gives the resume an ATS-friendly opening with role positioning, skill signals, and visible value."
          : "The summary is not yet doing enough work to establish role fit in the first few lines.",
      whatWorks: unique([
        params.summaryStats.hasYears ? "Years of experience are stated early." : "",
        params.summaryStats.hasMetric ? "The summary includes quantified value rather than generic positioning." : "",
        params.summaryStats.first50KeywordMatches >= 2 ? "Critical keywords appear in the first 50 words." : "",
      ]).filter(Boolean),
      gaps:
        params.summaryScore < 75
          ? unique([
              params.summaryStats.lineCount > 0 && (params.summaryStats.lineCount < 3 || params.summaryStats.lineCount > 4)
                ? "Keep the summary within 3 to 4 lines."
                : "",
              !params.summaryStats.hasMetric ? "Add one quantified outcome to the summary." : "",
              params.summaryStats.hasObjectiveLanguage ? "Replace objective-style wording with value-focused language." : "",
              params.summaryStats.matchedCriticalTerms < 2
                ? "Add supported role-specific skills or title terms near the top."
                : "",
            ]).filter(Boolean)
          : [],
      actions: ["Keep the summary to 3 to 4 lines and front-load title, years, impact, and core skills."],
    },
    {
      id: "workExperience",
      title: "Work Experience",
      score: params.contentScore,
      status: classifyStatus(params.contentScore),
      diagnosis:
        params.contentScore >= 75
          ? "Experience bullets show useful achievement evidence, technical context, and measurable outcomes."
          : "Experience bullets need stronger action-result structure, more metrics, and clearer ownership.",
      whatWorks: unique([
        params.bulletStats.quantified > 0
          ? `${params.bulletStats.quantified} bullet${params.bulletStats.quantified === 1 ? "" : "s"} include quantifiable evidence.`
          : "",
        params.bulletStats.businessImpact > 0
          ? `${params.bulletStats.businessImpact} bullet${params.bulletStats.businessImpact === 1 ? "" : "s"} reference business or customer impact.`
          : "",
        params.bulletStats.toolMentioned > 0
          ? `${params.bulletStats.toolMentioned} bullet${params.bulletStats.toolMentioned === 1 ? "" : "s"} include tools, platforms, or technologies.`
          : "",
      ]).filter(Boolean),
      gaps:
        params.contentScore < 75
          ? unique([
              params.bulletStats.repeatedLeadVerbs.length > 0
                ? `Reduce repeated lead verbs such as ${params.bulletStats.repeatedLeadVerbs.slice(0, 2).join(", ")}.`
                : "",
              params.bulletStats.passiveVoice > 0 ? "Reduce passive phrasing in bullet openings." : "",
              params.bulletStats.duplicateBullets > 0 ? "Remove duplicate or near-duplicate bullet structures." : "",
              params.bulletStats.starLike / Math.max(1, params.bulletStats.total) < 0.4
                ? "Increase the share of bullets with context, action, result, and timeframe."
                : "",
            ]).filter(Boolean)
          : [],
      actions: ["Use action + what + how + quantified result + timeframe in core bullets."],
    },
    {
      id: "skills",
      title: "Skills",
      score: params.skillsScore,
      status: classifyStatus(params.skillsScore),
      diagnosis:
        params.skillsScore >= 75
          ? "The skills section is structured well enough to support keyword retrieval and recruiter scanning."
          : "The skills section is too generic or too thin for strong ATS matching.",
      whatWorks: unique([
        params.skillsAnalysis.categoryLabels.length >= 2 ? "Skills are grouped into readable categories." : "",
        params.skillsAnalysis.canonicalTerms.length >= 8 ? "The section includes enough specific tools or platforms to support exact matching." : "",
      ]).filter(Boolean),
      gaps:
        params.skillsScore < 75
          ? unique([
              params.skillsAnalysis.items.length > 0 && (params.skillsAnalysis.items.length < 15 || params.skillsAnalysis.items.length > 25)
                ? "Keep the section focused at roughly 15 to 25 role-relevant skills."
                : "",
              params.skillsAnalysis.categoryLabels.length < 2 ? "Add clearer category labels such as Languages, Cloud, Frameworks, or Tools." : "",
              params.skillsAnalysis.genericTerms > Math.max(2, Math.floor(params.skillsAnalysis.items.length * 0.35))
                ? "Replace generic skill labels with more specific technologies or methods."
                : "",
            ]).filter(Boolean)
          : [],
      actions: ["Group skills into categories and use exact technology names instead of broad labels."],
    },
    {
      id: "education",
      title: "Education",
      score: params.educationScore,
      status: classifyStatus(params.educationScore),
      diagnosis:
        params.educationScore >= 75
          ? "Education is presented clearly enough for ATS verification of credentials."
          : "Education details are not yet structured clearly enough for fast requirement checking.",
      whatWorks: unique([
        params.qualification.meetsDegreeRequirement === true
          ? "The education section appears to satisfy the degree level requested by the role."
          : "",
        params.educationScore >= 75 ? "Degree, institution, and date information appear sufficiently visible." : "",
      ]).filter(Boolean),
      gaps:
        params.educationScore < 75
          ? unique([
              "Ensure the degree name, institution, and date are visible in a consistent format.",
              params.qualification.meetsDegreeRequirement === false
                ? "Make the required degree level explicit if you have it."
                : "",
            ]).filter(Boolean)
          : [],
      actions: ["Keep education entries in plain text with degree, institution, and completion date."],
    },
    {
      id: "keywords",
      title: "Keyword Alignment",
      score: keywordReviewScore,
      status: classifyStatus(keywordReviewScore),
      diagnosis:
        params.hasJD
          ? "Keyword alignment is based on deterministic matching against the provided job description and critical term placement."
          : "Without a job description, this score reflects general ATS keyword coverage in the summary, skills, and experience sections.",
      whatWorks: unique([
        params.keywordAnalysis && params.keywordAnalysis.matchedKeywords > 0
          ? `Matched ${params.keywordAnalysis.matchedKeywords} job-description keyword${params.keywordAnalysis.matchedKeywords === 1 ? "" : "s"}.`
          : "",
        params.keywordAnalysis && params.keywordAnalysis.coverageBySection.professionalSummary.length > 0
          ? "Critical keywords appear in the professional summary."
          : "",
        params.qualification.matchedRoleFamilies.length > 0
          ? "The resume vocabulary aligns with the target role family."
          : "",
      ]).filter(Boolean),
      gaps:
        params.hasJD && (params.keywordScore ?? 0) < 75
          ? unique([
              params.keywordAnalysis && params.keywordAnalysis.criticalMissingTerms.length > 0
                ? `Add supported critical terms such as ${params.keywordAnalysis.criticalMissingTerms.slice(0, 3).join(", ")}.`
                : "",
              params.keywordAnalysis && params.keywordAnalysis.coverageBySection.skills.length < 4
                ? "Increase skills-section coverage for the role's most important terms."
                : "",
              params.repetition.repeatedContentWords.length > 0
                ? `Replace repeated generic wording like ${params.repetition.repeatedContentWords.slice(0, 2).join(", ")} with more role-specific terms where accurate.`
                : "",
            ]).filter(Boolean)
          : [],
      actions: ["Mirror supported role terminology exactly where the resume already has matching evidence."],
    },
    {
      id: "formatting",
      title: "Formatting & ATS Safety",
      score: params.formattingScore,
      status: classifyStatus(params.formattingScore),
      diagnosis:
        params.formattingScore >= 75
          ? "The extracted text looks sufficiently parseable for ATS ingestion."
          : "There are structural or formatting signals that may reduce parse confidence.",
      whatWorks: unique([
        params.formattingScore >= 75 ? "The resume preserves enough structure for machine reading." : "",
        params.structureScore >= 75 ? "The section order and core layout are reasonably ATS-safe." : "",
      ]).filter(Boolean),
      gaps:
        params.formattingScore < 75
          ? unique([
              "Standard headers, complete contact info, consistent dates, and bullet formatting need attention.",
              params.summaryStats.firstPerson ? "Remove first-person phrasing from summary or bullets." : "",
            ]).filter(Boolean)
          : [],
      actions: ["Keep ATS-safe section headers, consistent dates, and plain-text contact details in the resume body."],
    },
  ]
}

function buildDebugAnalysis(params: {
  contact: ContactInfo
  dates: DateInfo
  bulletStats: BulletStats
  repetition: RepetitionStats
  summaryStats: SummaryStats
  missingSections: string[]
  missingOptionalSections: string[]
  skillsAnalysis: SkillsAnalysis
  keywordAnalysis: KeywordAnalysis | null
  qualification: QualificationAlignment
  atsCompatibility: ATSScoreResponse["atsCompatibility"]
}): ATSScoreResponse["debugAnalysis"] {
  const sections: ATSScoreResponse["debugAnalysis"] = []

  const summaryItems: ATSScoreResponse["debugAnalysis"][number]["items"] = []
  if (params.summaryStats.lineCount > 0) {
    summaryItems.push({
      label: "Summary length",
      detail: `${params.summaryStats.lineCount} lines / ${params.summaryStats.wordCount} words`,
      suggestion:
        params.summaryStats.lineCount < 3 || params.summaryStats.lineCount > 4
          ? "Keep the summary within 3 to 4 lines for better ATS positioning."
          : undefined,
      severity:
        params.summaryStats.lineCount >= 3 && params.summaryStats.lineCount <= 4 ? "good" : "warning",
    })
    summaryItems.push({
      label: "Core signals",
      detail: [
        params.summaryStats.hasYears ? "years" : null,
        params.summaryStats.hasMetric ? "metric" : null,
        params.summaryStats.hasRoleTitle ? "title" : null,
        params.summaryStats.hasCoreSkills ? "skills" : null,
      ].filter(Boolean).join(", ") || "No major ATS summary signals detected",
      suggestion:
        !params.summaryStats.hasYears || !params.summaryStats.hasMetric || !params.summaryStats.hasCoreSkills
          ? "Add role title, years of experience, one quantified outcome, and core skills near the top."
          : undefined,
      severity:
        params.summaryStats.hasYears && params.summaryStats.hasMetric && params.summaryStats.hasCoreSkills
          ? "good"
          : "warning",
    })
    if (params.summaryStats.hasObjectiveLanguage) {
      summaryItems.push({
        label: "Objective-style phrasing",
        detail: "The summary includes job-seeker wording such as seeking/objective language.",
        suggestion: "Replace objective language with value-focused role positioning.",
        severity: "warning",
      })
    }
  }
  if (summaryItems.length > 0) {
    sections.push({
      id: "summary",
      title: "Summary Analysis",
      summary: "These checks evaluate the summary as the resume's first ATS entry point.",
      items: summaryItems,
    })
  }

  if (params.keywordAnalysis) {
    const keywordItems: ATSScoreResponse["debugAnalysis"][number]["items"] = [
      {
        label: "Matched required keywords",
        detail: `${params.keywordAnalysis.matchedByCategory.required.length} matched / ${params.keywordAnalysis.missingByCategory.required.length} missing`,
        suggestion:
          params.keywordAnalysis.missingByCategory.required.length > 0
            ? "Add supported required terms to the summary, skills section, and recent-role bullets."
            : undefined,
        severity:
          params.keywordAnalysis.missingByCategory.required.length === 0
            ? "good"
            : params.keywordAnalysis.missingByCategory.required.length <= 5
              ? "warning"
              : "critical",
      },
      {
        label: "Keyword density",
        detail: `${params.keywordAnalysis.keywordDensity}%`,
        suggestion:
          params.keywordAnalysis.keywordDensity < 1.5 || params.keywordAnalysis.keywordDensity > 4.5
            ? "Keep supported role keywords distributed naturally across the resume."
            : undefined,
        severity:
          params.keywordAnalysis.keywordDensity >= 1.5 && params.keywordAnalysis.keywordDensity <= 4.5
            ? "good"
            : "warning",
      },
      {
        label: "Role-family overlap",
        detail:
          params.qualification.matchedRoleFamilies.length > 0
            ? params.qualification.matchedRoleFamilies.join(", ")
            : "No strong role-family match detected",
        suggestion:
          params.qualification.matchedRoleFamilies.length === 0
            ? "Increase evidence for the target role family in the summary, skills, and most relevant experience bullets."
            : undefined,
        severity: params.qualification.matchedRoleFamilies.length > 0 ? "good" : "warning",
      },
    ]

    if (params.keywordAnalysis.criticalMissingTerms.length > 0) {
      keywordItems.push({
        label: "Missing critical terms",
        detail: params.keywordAnalysis.criticalMissingTerms.slice(0, 6).join(", "),
        suggestion: "Add only the missing terms that are supported by real experience or skills.",
        severity: "warning",
      })
    }

    sections.push({
      id: "keywords",
      title: "Keyword Coverage",
      summary: "These checks focus on deterministic job-description matching and keyword placement.",
      items: keywordItems,
    })
  }

  const repetitionItems: ATSScoreResponse["debugAnalysis"][number]["items"] = []
  if (params.repetition.repeatedContentWords.length > 0) {
    repetitionItems.push({
      label: "Repeated content words",
      detail: params.repetition.repeatedContentWords.slice(0, 6).join(", "),
      suggestion: "Replace repeated generic wording with more specific technical or impact language where accurate.",
      severity: "warning",
    })
  }
  if (params.repetition.repeatedPhrases.length > 0) {
    repetitionItems.push({
      label: "Repeated phrases",
      detail: params.repetition.repeatedPhrases.slice(0, 4).join(", "),
      suggestion: "Vary sentence structures and avoid recycling the same phrase across multiple bullets.",
      severity: "warning",
    })
  }
  if (params.repetition.duplicateBulletFragments.length > 0) {
    repetitionItems.push({
      label: "Duplicate bullet fragments",
      detail: params.repetition.duplicateBulletFragments.slice(0, 4).join(", "),
      suggestion: "Rewrite overlapping bullets so each one shows a distinct scope or outcome.",
      severity: "warning",
    })
  }
  if (params.bulletStats.repeatedLeadVerbs.length > 0) {
    repetitionItems.push({
      label: "Repeated lead verbs",
      detail: params.bulletStats.repeatedLeadVerbs.slice(0, 5).join(", "),
      suggestion: "Vary opening verbs across bullets to avoid a templated experience section.",
      severity: "warning",
    })
  }
  if (repetitionItems.length > 0) {
    sections.push({
      id: "repetition",
      title: "Repeated Words",
      summary: "The scorer found wording patterns that reduce precision and variety.",
      items: repetitionItems,
    })
  }

  const formattingItems: ATSScoreResponse["debugAnalysis"][number]["items"] = []
  if (params.dates.formats.length > 0) {
    formattingItems.push({
      label: "Detected date formats",
      detail: params.dates.formats.join(", "),
      suggestion: params.dates.consistent ? undefined : "Standardize all dates to one format, preferably MM/YYYY or Mon YYYY.",
      severity: params.dates.consistent ? "good" : "warning",
    })
  }
  if (!params.dates.consistent && params.dates.formats.length > 1) {
    formattingItems.push({
      label: "Date consistency",
      detail: "Multiple date formats detected across the resume.",
      suggestion: "Use one consistent date format across jobs, education, and certifications.",
      severity: "warning",
    })
  }
  if (!params.bulletStats.consistentMarkers && params.bulletStats.total > 2) {
    formattingItems.push({
      label: "Bullet formatting",
      detail: "Different bullet markers were detected in the resume.",
      suggestion: "Use one bullet style consistently across all experience and project sections.",
      severity: "warning",
    })
  }
  if (params.dates.futureDates.length > 0) {
    formattingItems.push({
      label: "Future-dated entries",
      detail: params.dates.futureDates.join(", "),
      suggestion: "Check date ranges and ensure all future dates are intentional and correct.",
      severity: "critical",
    })
  }
  if (!params.contact.professionalEmail && params.contact.email) {
    formattingItems.push({
      label: "Email presentation",
      detail: "Email format may look informal.",
      suggestion: "Use a straightforward professional email address if possible.",
      severity: "warning",
    })
  }
  if (formattingItems.length > 0) {
    sections.push({
      id: "formatting",
      title: "Formatting Consistency",
      summary: "These checks come from the local scorer's ATS-safe formatting rules.",
      items: formattingItems,
    })
  }

  const bulletItems: ATSScoreResponse["debugAnalysis"][number]["items"] = []
  if (params.bulletStats.total > 0) {
    bulletItems.push({
      label: "Average bullet length",
      detail: `${params.bulletStats.averageWordCount} words`,
      suggestion:
        params.bulletStats.averageWordCount < 12 || params.bulletStats.averageWordCount > 28
          ? "Keep most bullets concise but complete, ideally around 12 to 28 words."
          : undefined,
      severity:
        params.bulletStats.averageWordCount >= 12 && params.bulletStats.averageWordCount <= 28
          ? "good"
          : "warning",
    })
    bulletItems.push({
      label: "Quantified bullets",
      detail: `${params.bulletStats.quantified}/${params.bulletStats.total} include measurable outcomes`,
      suggestion:
        params.bulletStats.quantified / params.bulletStats.total < 0.6
          ? "Add metrics, scale, or business impact to more experience bullets."
          : undefined,
      severity: params.bulletStats.quantified / params.bulletStats.total >= 0.6 ? "good" : "warning",
    })
    bulletItems.push({
      label: "STAR-like bullets",
      detail: `${params.bulletStats.starLike}/${params.bulletStats.total} show action-result structure`,
      suggestion:
        params.bulletStats.starLike / params.bulletStats.total < 0.4
          ? "Strengthen bullet structure with action, context, result, and timeframe."
          : undefined,
      severity: params.bulletStats.starLike / params.bulletStats.total >= 0.4 ? "good" : "warning",
    })
    bulletItems.push({
      label: "Business impact bullets",
      detail: `${params.bulletStats.businessImpact}/${params.bulletStats.total} mention business or customer outcomes`,
      suggestion:
        params.bulletStats.businessImpact / params.bulletStats.total < 0.35
          ? "Tie more bullets to cost, revenue, speed, quality, reliability, customer, or efficiency outcomes."
          : undefined,
      severity: params.bulletStats.businessImpact / params.bulletStats.total >= 0.35 ? "good" : "warning",
    })
    if (params.bulletStats.passiveVoice > 0) {
      bulletItems.push({
        label: "Passive phrasing",
        detail: `${params.bulletStats.passiveVoice} bullet${params.bulletStats.passiveVoice === 1 ? "" : "s"} may use passive voice`,
        suggestion: "Start bullets with direct accomplishment verbs where accurate.",
        severity: "warning",
      })
    }
    if (params.bulletStats.tooShort > 0 || params.bulletStats.tooLong > 0) {
      bulletItems.push({
        label: "Length outliers",
        detail: `${params.bulletStats.tooShort} short, ${params.bulletStats.tooLong} long`,
        suggestion: "Trim long bullets and expand vague short bullets so they carry one clear achievement.",
        severity: "warning",
      })
    }
  }
  if (bulletItems.length > 0) {
    sections.push({
      id: "bullets",
      title: "Bullet Quality",
      summary: "These checks reflect quantification, STAR structure, and bullet readability.",
      items: bulletItems,
    })
  }

  const structureItems: ATSScoreResponse["debugAnalysis"][number]["items"] = [
    {
      label: "Required sections present",
      detail:
        params.missingSections.length === 0 ? "All ATS-critical sections detected" : `Missing: ${params.missingSections.join(", ")}`,
      suggestion:
        params.missingSections.length > 0
          ? "Add standard ATS-safe section headers like Professional Summary, Work Experience, Skills, and Education."
          : undefined,
      severity: params.missingSections.length === 0 ? "good" : "critical",
    },
    {
      label: "Contact information",
      detail:
        [
          params.contact.email ? "email" : null,
          params.contact.phone ? "phone" : null,
          params.contact.location ? "location" : null,
          params.contact.linkedin ? "LinkedIn" : null,
          params.contact.github ? "GitHub" : null,
        ]
          .filter(Boolean)
          .join(", ") || "No contact signals detected",
      suggestion:
        !params.contact.email || !params.contact.phone
          ? "Keep email and phone in plain text near the top of the resume body."
          : undefined,
      severity: params.contact.email && params.contact.phone ? "good" : "critical",
    },
    {
      label: "Skills inventory",
      detail: `${params.skillsAnalysis.items.length} skill entries detected`,
      suggestion:
        params.skillsAnalysis.items.length > 0 &&
        (params.skillsAnalysis.items.length < 15 || params.skillsAnalysis.items.length > 25)
          ? "Aim for roughly 15 to 25 targeted skills grouped by category."
          : undefined,
      severity:
        params.skillsAnalysis.items.length === 0
          ? "critical"
          : params.skillsAnalysis.items.length >= 15 && params.skillsAnalysis.items.length <= 25
            ? "good"
            : "warning",
    },
  ]
  if (params.missingOptionalSections.length > 0) {
    structureItems.push({
      label: "Missing optional role-relevant sections",
      detail: params.missingOptionalSections.join(", "),
      suggestion: "Add only the optional sections that are genuinely supported by your background.",
      severity: "info",
    })
  }

  sections.push({
    id: "structure",
    title: "Structure Analysis",
    summary: "The local scorer checks ATS-safe sections, contact data, skills coverage, and required structure.",
    items: structureItems,
  })

  const compatibilityItems: ATSScoreResponse["debugAnalysis"][number]["items"] = [
    {
      label: "Parseability",
      detail: `${params.atsCompatibility.parseability}%`,
      suggestion:
        params.atsCompatibility.parseability < 80
          ? "Improve section headers, contact placement, bullet consistency, and date formatting to raise parse confidence."
          : undefined,
      severity:
        params.atsCompatibility.parseability >= 80
          ? "good"
          : params.atsCompatibility.parseability >= 60
            ? "warning"
            : "critical",
    },
    ...params.atsCompatibility.issues.map((issue) => ({
      label: "Critical issue",
      detail: issue,
      severity: "critical" as const,
    })),
    ...params.atsCompatibility.warnings.slice(0, 3).map((warning) => ({
      label: "Warning",
      detail: warning,
      severity: "warning" as const,
    })),
  ]

  sections.push({
    id: "atsCompatibility",
    title: "ATS Compatibility",
    summary: "These checks show how reliably the resume structure should survive ATS parsing.",
    items: compatibilityItems,
  })

  return sections
}

function buildRating(score: number): ATSScoreResponse["rating"] {
  if (score >= 90) return "Excellent"
  if (score >= 80) return "Very Good"
  if (score >= 70) return "Good"
  if (score >= 60) return "Fair"
  return "Poor"
}

export function scoreResumeDeterministically(input: {
  resumeContent: string
  jobDescription?: string
  extractionArtifacts?: DocumentArtifacts | null
}): DeterministicATSResult {
  const resumeContent = normalizeWhitespace(input.resumeContent)
  const jobDescription = normalizeWhitespace(input.jobDescription || "")
  const hasJD = jobDescription.length > 0

  const parsedSections = extractSections(resumeContent)
  const artifactSections = extractSectionsFromArtifacts(input.extractionArtifacts)
  const { sections, order } = mergeSectionResults(parsedSections, artifactSections)
  const structureSignals = deriveDocumentStructureSignals(input.extractionArtifacts)
  const summaryText = getSectionText(sections.professionalSummary)
  const skillsText = getSectionText(sections.skills)
  const experienceText = getSectionText(sections.workExperience)
  const educationText = getSectionText(sections.education)
  const projectText = getSectionText(sections.projects)
  const certificationText = getSectionText(sections.certifications)

  const contact = detectContactInfo(resumeContent)
  const dates = extractDateInfo(resumeContent)
  const experienceDates = extractDateInfo(`${experienceText}\n${projectText}`)
  const jdAnalysis = analyzeJobDescription(jobDescription)
  const summaryStats = analyzeSummary(summaryText, jdAnalysis)
  const repetition = analyzeRepetition(resumeContent, jdAnalysis)
  const skillsAnalysis = analyzeSkillsSection(skillsText)
  const lexicalCoverage = buildResumeLexicalCoverage(resumeContent, sections)
  const keywordAnalysis = buildKeywordAnalysis(jdAnalysis, resumeContent, sections)
  const criticalTerms = unique([
    ...(jdAnalysis?.titleTerms || []),
    ...(jdAnalysis?.requiredTerms || []).slice(0, 20),
    ...(jdAnalysis?.responsibilityTerms || []).slice(0, 10),
  ])
  const bulletStats = extractBulletStats(experienceText, projectText, criticalTerms)
  const keywordScore = keywordAnalysis ? scoreKeywordMatch(keywordAnalysis, jdAnalysis, lexicalCoverage) : null
  const summaryScore = scoreProfessionalSummary(summaryText, jdAnalysis, summaryStats)
  const skillsScore = scoreSkills(skillsText, jdAnalysis, skillsAnalysis)
  const contentQualityScore = scoreContentQuality(bulletStats, repetition, lexicalCoverage)
  const structureScore = scoreStructure(sections, order, contact, summaryStats, skillsAnalysis, jdAnalysis, structureSignals)
  const formatting = scoreFormatting(sections, contact, dates, resumeContent, bulletStats, structureSignals)
  const educationScore = scoreEducation(educationText, jdAnalysis)
  const qualification = inferQualificationAlignment(
    jdAnalysis,
    educationText,
    experienceDates.yearsEstimated !== null ? experienceDates : dates,
    `${resumeContent}\n${certificationText}`,
    lexicalCoverage,
    summaryText,
    experienceText
  )

  const missingSections = REQUIRED_SECTION_KEYS.filter((key) => !sections[key]).map((key) => titleCase(key))
  const missingOptionalSections = (jdAnalysis?.optionalSections || [])
    .filter((key) => !sections[key])
    .map((key) => titleCase(key))
  const calibratedScores = calibrateScores({
    hasJD,
    jdAnalysis,
    formattingScore: formatting.score,
    contentQualityScore,
    summaryScore,
    skillsScore,
    structureScore,
    educationScore,
    keywordScore,
    qualificationScore: qualification.score,
    missingRequiredSectionCount: missingSections.length,
    contact,
    qualification,
  })

  const derived = buildIssuesAndRecommendations({
    hasJD,
    formattingScore: formatting.score,
    structureScore,
    summaryScore,
    summaryStats,
    skillsScore,
    skillsAnalysis,
    contentScore: contentQualityScore,
    keywordScore,
    educationScore,
    bulletStats,
    repetition,
    qualification,
    keywordAnalysis,
    lexicalCoverage,
    contact,
    dates,
    missingSections,
    missingOptionalSections,
  })

  const sectionReviews = buildSectionReviews({
    hasJD,
    summaryScore,
    contentScore: contentQualityScore,
    skillsScore,
    educationScore,
    formattingScore: formatting.score,
    keywordScore,
    structureScore,
    bulletStats,
    summaryStats,
    repetition,
    skillsAnalysis,
    keywordAnalysis,
    qualification,
  })
  const debugAnalysis = buildDebugAnalysis({
    contact,
    dates,
    bulletStats,
    repetition,
    summaryStats,
    missingSections,
    missingOptionalSections,
    skillsAnalysis,
    keywordAnalysis,
    qualification,
    atsCompatibility: {
      parseability: formatting.parseability,
      issues: formatting.issues,
      warnings: formatting.warnings,
    },
  })

  return {
    analysisMode: hasJD ? "resume-with-jd" : "resume-only",
    resumeQualityScore: calibratedScores.resumeQualityScore,
    targetRoleScore: calibratedScores.targetRoleScore,
    overallScore: calibratedScores.overallScore,
    categoryScores: {
      keywordMatch: hasJD ? { score: keywordScore || 0, maxScore: 100 } : null,
      formatting: { score: formatting.score, maxScore: 100 },
      contentQuality: { score: contentQualityScore, maxScore: 100 },
      professionalSummary: { score: summaryScore, maxScore: 100 },
      skills: { score: skillsScore, maxScore: 100 },
      structure: hasJD ? null : { score: structureScore, maxScore: 100 },
    },
    rating: buildRating(calibratedScores.overallScore),
    keyFindings: {
      strengths: derived.strengths,
      weaknesses: derived.weaknesses,
      missingKeywords: hasJD ? keywordAnalysis?.missingByCategory.required.slice(0, 20) || [] : null,
      presentKeywords: hasJD
        ? unique([
            ...(keywordAnalysis?.matchedByCategory.title || []),
            ...(keywordAnalysis?.matchedByCategory.required || []),
            ...(keywordAnalysis?.matchedByCategory.preferred || []),
            ...(keywordAnalysis?.matchedByCategory.culture || []),
          ]).slice(0, 20)
        : null,
    },
    detailedIssues: derived.issues,
    recommendations: derived.recommendations,
    sectionReviews,
    atsCompatibility: {
      parseability: formatting.parseability,
      issues: formatting.issues,
      warnings: formatting.warnings,
    },
    keywordAnalysis,
    debugAnalysis,
    evidence: {
      requiredSectionsPresent: REQUIRED_SECTION_KEYS.filter((key) => sections[key]).map((key) => titleCase(key)),
      missingSections,
      missingOptionalSections,
      contact,
      dates,
      bullets: bulletStats,
      summary: summaryStats,
      repetition,
      jd: jdAnalysis,
      lexicalCoverage,
      qualification: {
        yearsRequired: qualification.yearsRequired,
        yearsEstimated: qualification.yearsEstimated,
        meetsYearsRequirement: qualification.meetsYearsRequirement,
        degreeRequirement: qualification.degreeRequirement,
        meetsDegreeRequirement: qualification.meetsDegreeRequirement,
        requiredCertifications: qualification.requiredCertifications,
        missingCertifications: qualification.missingCertifications,
        expectedSeniority: qualification.expectedSeniority,
        observedSeniority: qualification.observedSeniority,
        seniorityAligned: qualification.seniorityAligned,
        managementRequired: qualification.managementRequired,
        managementObserved: qualification.managementObserved,
        matchedRoleFamilies: qualification.matchedRoleFamilies,
      },
    },
  }
}
