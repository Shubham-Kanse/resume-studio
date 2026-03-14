export type ActionVerbCategory =
  | "Achievement"
  | "Communication"
  | "Entrepreneurial"
  | "Management"
  | "Leadership"
  | "Research"
  | "Problem Solving"
  | "Operations"
  | "Financial"
  | "Design"
  | "Clerical"

export type ActionVerbEntry = {
  verb: string
  categories: ActionVerbCategory[]
  useWhen: string
  replaces: string[]
}

export type WeakActionVerbEntry = {
  weak: string
  replacements: string[]
  note: string
}

const CATEGORY_META: Record<
  ActionVerbCategory,
  { useWhen: string; replaces: string[] }
> = {
  Achievement: {
    useWhen:
      "you delivered a measurable result, accelerated progress, or changed the outcome in a visible way",
    replaces: ["helped", "worked on", "responsible for", "involved in"],
  },
  Communication: {
    useWhen:
      "you persuaded, explained, presented, aligned, or guided stakeholders through information",
    replaces: ["spoke to", "talked with", "helped", "worked with"],
  },
  Entrepreneurial: {
    useWhen:
      "you built, launched, initiated, or started something from the ground up",
    replaces: ["started", "made", "worked on", "helped create"],
  },
  Management: {
    useWhen:
      "you planned work, delegated ownership, supervised people, or directed execution",
    replaces: ["managed", "oversaw", "handled", "was responsible for"],
  },
  Leadership: {
    useWhen:
      "you coached, mentored, enabled, or drove people toward a stronger outcome",
    replaces: ["helped", "supported", "guided", "worked with"],
  },
  Research: {
    useWhen:
      "you investigated, analyzed, forecasted, tested, or validated information before making decisions",
    replaces: ["looked at", "checked", "reviewed", "worked on"],
  },
  "Problem Solving": {
    useWhen:
      "you removed blockers, simplified complexity, or fixed operational or delivery issues",
    replaces: ["fixed", "improved", "helped", "handled"],
  },
  Operations: {
    useWhen:
      "you improved process flow, efficiency, throughput, cost, or delivery reliability",
    replaces: ["improved", "worked on", "handled", "supported"],
  },
  Financial: {
    useWhen:
      "you modeled, budgeted, audited, projected, or controlled financial outcomes",
    replaces: ["reviewed", "checked", "handled", "worked on"],
  },
  Design: {
    useWhen:
      "you designed, shaped, revised, or structured a product, system, asset, or experience",
    replaces: ["made", "created", "worked on", "updated"],
  },
  Clerical: {
    useWhen:
      "you processed, organized, tracked, screened, or maintained records with precision",
    replaces: ["did", "handled", "worked on", "helped with"],
  },
}

const CATEGORY_VERBS: Record<ActionVerbCategory, string[]> = {
  Achievement: [
    "Accelerated",
    "Achieved",
    "Attained",
    "Built",
    "Completed",
    "Conceived",
    "Convinced",
    "Discovered",
    "Delivered",
    "Doubled",
    "Effected",
    "Eliminated",
    "Engineered",
    "Expanded",
    "Expedited",
    "Founded",
    "Improved",
    "Increased",
    "Initiated",
    "Innovated",
    "Introduced",
    "Invented",
    "Launched",
    "Mastered",
    "Overcame",
    "Overhauled",
    "Pioneered",
    "Reduced",
    "Refactored",
    "Resolved",
    "Revitalised",
    "Simulated",
    "Spearheaded",
    "Strengthened",
    "Transformed",
    "Tripled",
    "Upgraded",
  ],
  Communication: [
    "Addressed",
    "Advised",
    "Arranged",
    "Authored",
    "Co-authored",
    "Communicated",
    "Co-ordinated",
    "Corresponded",
    "Counselled",
    "Demonstrated",
    "Developed",
    "Directed",
    "Drafted",
    "Enlisted",
    "Facilitated",
    "Formulated",
    "Guided",
    "Influenced",
    "Interpreted",
    "Interviewed",
    "Instructed",
    "Lectured",
    "Led",
    "Liased",
    "Mediated",
    "Moderated",
    "Motivated",
    "Negotiated",
    "Persuaded",
    "Presented",
    "Promoted",
    "Proposed",
    "Publicised",
    "Recommended",
    "Reconciled",
    "Recruited",
    "Resolved",
    "Taught",
    "Trained",
    "Translated",
  ],
  Entrepreneurial: [
    "Built",
    "Composed",
    "Conceived",
    "Created",
    "Delivered",
    "Designed",
    "Developed",
    "Devised",
    "Engineered",
    "Established",
    "Founded",
    "Generated",
    "Implemented",
    "Initiated",
    "Instituted",
    "Introduced",
    "Launched",
    "Led",
    "Opened",
    "Originated",
    "Pioneered",
    "Planned",
    "Prepared",
    "Produced",
    "Promoted",
    "Released",
    "Started",
  ],
  Management: [
    "Administered",
    "Analysed",
    "Assigned",
    "Chaired",
    "Consolidated",
    "Contracted",
    "Co-ordinated",
    "Delegated",
    "Developed",
    "Directed",
    "Evaluated",
    "Executed",
    "Guided",
    "Managed",
    "Organised",
    "Oversaw",
    "Planned",
    "Prioritised",
    "Produced",
    "Recommended",
    "Reorganised",
    "Reviewed",
    "Scheduled",
    "Supervised",
  ],
  Leadership: [
    "Accelerated",
    "Achieved",
    "Adapted",
    "Allocated",
    "Assessed",
    "Authored",
    "Awarded",
    "Clarified",
    "Coached",
    "Conducted",
    "Coordinated",
    "Counseled",
    "Demonstrated",
    "Developed",
    "Directed",
    "Educated",
    "Enabled",
    "Encouraged",
    "Evaluated",
    "Explained",
    "Facilitated",
    "Familiarised",
    "Guided",
    "Illustrated",
    "Influenced",
    "Informed",
    "Instructed",
    "Lectured",
    "Led",
    "Managed",
    "Mentored",
    "Moderated",
    "Motivated",
    "Organised",
    "Participated",
    "Performed",
    "Persuaded",
    "Presented",
    "Provided",
    "Referred",
    "Rehabilitated",
    "Reinforced",
    "Represented",
    "Revamped",
    "Spearheaded",
    "Stimulated",
    "Taught",
    "Trained",
    "Verified",
  ],
  Research: [
    "Analysed",
    "Assessed",
    "Classified",
    "Clarified",
    "Collected",
    "Collated",
    "Critiqued",
    "Defined",
    "Devised",
    "Diagnosed",
    "Established",
    "Evaluated",
    "Examined",
    "Extracted",
    "Forecasted",
    "Identified",
    "Inspected",
    "Inspired",
    "Interpreted",
    "Interviewed",
    "Investigated",
    "Organised",
    "Researched",
    "Reviewed",
    "Summarised",
    "Surveyed",
    "Systemised",
    "Tested",
    "Traced",
    "Uncovered",
    "Verified",
  ],
  "Problem Solving": [
    "Arranged",
    "Budgeted",
    "Built",
    "Composed",
    "Conceived",
    "Conducted",
    "Controlled",
    "Co-ordinated",
    "Eliminated",
    "Examined",
    "Improved",
    "Investigated",
    "Itemised",
    "Modernised",
    "Operated",
    "Organised",
    "Planned",
    "Prepared",
    "Processed",
    "Produced",
    "Redesigned",
    "Reduced",
    "Refactored",
    "Refined",
    "Researched",
    "Resolved",
    "Reviewed",
    "Revised",
    "Simulated",
    "Revamped",
    "Scheduled",
    "Simplified",
    "Solved",
    "Streamlined",
    "Transformed",
  ],
  Operations: [
    "Broadened",
    "Built",
    "Combined",
    "Consolidated",
    "Converted",
    "Cut",
    "Decreased",
    "Delivered",
    "Developed",
    "Devised",
    "Doubled",
    "Engineered",
    "Eliminated",
    "Expanded",
    "Improved",
    "Increased",
    "Innovated",
    "Minimised",
    "Modernised",
    "Recommended",
    "Redesigned",
    "Reduced",
    "Refactored",
    "Refined",
    "Reorganised",
    "Resolved",
    "Restructured",
    "Revised",
    "Revamped",
    "Saved",
    "Serviced",
    "Simplified",
    "Solved",
    "Streamlined",
    "Strengthened",
    "Transformed",
    "Trimmed",
    "Tripled",
    "Unified",
    "Widened",
  ],
  Financial: [
    "Administered",
    "Allocated",
    "Analysed",
    "Appraised",
    "Audited",
    "Balanced",
    "Budgeted",
    "Calculated",
    "Computed",
    "Developed",
    "Managed",
    "Modelled",
    "Planned",
    "Projected",
    "Researched",
    "Restructured",
  ],
  Design: [
    "Acted",
    "Conceptualised",
    "Created",
    "Customised",
    "Designed",
    "Developed",
    "Directed",
    "Established",
    "Fashioned",
    "Illustrated",
    "Integrated",
    "Instituted",
    "Performed",
    "Planned",
    "Proved",
    "Redesigned",
    "Revised",
    "Revitalised",
    "Set up",
    "Shaped",
    "Streamlined",
    "Structured",
    "Tabulated",
    "Validated",
  ],
  Clerical: [
    "Approved",
    "Arranged",
    "Catalogued",
    "Classified",
    "Collected",
    "Compiled",
    "Dispatched",
    "Executed",
    "Filed",
    "Generated",
    "Implemented",
    "Inspected",
    "Monitored",
    "Operated",
    "Ordered",
    "Organised",
    "Prepared",
    "Processed",
    "Purchased",
    "Recorded",
    "Retrieved",
    "Screened",
    "Specified",
    "Systematised",
  ],
}

export const ACTION_VERB_CATEGORIES = Object.keys(
  CATEGORY_VERBS
) as ActionVerbCategory[]

const verbMap = new Map<string, ActionVerbEntry>()

for (const category of ACTION_VERB_CATEGORIES) {
  for (const rawVerb of CATEGORY_VERBS[category]) {
    const key = rawVerb.toLowerCase()
    const existing = verbMap.get(key)

    if (existing) {
      if (!existing.categories.includes(category)) {
        existing.categories.push(category)
      }
      continue
    }

    verbMap.set(key, {
      verb: rawVerb,
      categories: [category],
      useWhen: CATEGORY_META[category].useWhen,
      replaces: CATEGORY_META[category].replaces,
    })
  }
}

export const ACTION_VERB_DICTIONARY: ActionVerbEntry[] = [
  ...verbMap.values(),
].sort((left, right) => left.verb.localeCompare(right.verb))

const RAW_WEAK_ACTION_VERBS: Array<{
  weak: string
  replacements: string[]
  note: string
}> = [
  {
    weak: "helped",
    replacements: [
      "Supported",
      "Enabled",
      "Facilitated",
      "Improved",
      "Delivered",
    ],
    note: "Use a verb that clarifies whether you enabled, improved, built, or delivered the result.",
  },
  {
    weak: "assisted",
    replacements: [
      "Supported",
      "Facilitated",
      "Coordinated",
      "Enabled",
      "Streamlined",
    ],
    note: "Assisted sounds passive. Pick the verb that shows your actual contribution to the outcome.",
  },
  {
    weak: "worked on",
    replacements: [
      "Built",
      "Developed",
      "Executed",
      "Delivered",
      "Implemented",
    ],
    note: "Worked on hides ownership. Replace it with the action you actually carried out.",
  },
  {
    weak: "responsible for",
    replacements: ["Managed", "Led", "Owned", "Directed", "Oversaw"],
    note: "Responsible for describes accountability, not action. Use the verb that shows what you did.",
  },
  {
    weak: "involved in",
    replacements: ["Led", "Supported", "Coordinated", "Executed", "Delivered"],
    note: "Involved in is vague. Clarify whether you led it, supported it, or executed a specific part.",
  },
  {
    weak: "participated in",
    replacements: [
      "Contributed",
      "Collaborated",
      "Presented",
      "Executed",
      "Coordinated",
    ],
    note: "Participated in undersells your role. Use the action that shows what you actually contributed.",
  },
  {
    weak: "did",
    replacements: ["Executed", "Completed", "Delivered", "Produced", "Handled"],
    note: "Did is too generic for CV writing. Replace it with a precise action verb.",
  },
  {
    weak: "made",
    replacements: ["Created", "Built", "Produced", "Designed", "Developed"],
    note: "Made sounds informal. Choose the verb that matches whether you built, designed, or produced it.",
  },
  {
    weak: "used",
    replacements: [
      "Applied",
      "Leveraged",
      "Implemented",
      "Operated",
      "Utilized",
    ],
    note: "Used rarely adds value on its own. Show how you applied the tool or method to achieve an outcome.",
  },
  {
    weak: "handled",
    replacements: [
      "Managed",
      "Oversaw",
      "Resolved",
      "Processed",
      "Coordinated",
    ],
    note: "Handled is broad. Be more exact about whether you managed, resolved, or processed the work.",
  },
  {
    weak: "looked at",
    replacements: [
      "Analyzed",
      "Reviewed",
      "Evaluated",
      "Investigated",
      "Assessed",
    ],
    note: "Looked at sounds casual. Use a stronger analytical verb that reflects the depth of your work.",
  },
  {
    weak: "checked",
    replacements: ["Verified", "Audited", "Inspected", "Reviewed", "Validated"],
    note: "Checked is too light for formal experience bullets. Replace it with the exact quality-control action.",
  },
  {
    weak: "fixed",
    replacements: [
      "Resolved",
      "Corrected",
      "Eliminated",
      "Remediated",
      "Stabilized",
    ],
    note: "Fixed is understandable but generic. Use a verb that shows how you removed the issue.",
  },
  {
    weak: "improved",
    replacements: [
      "Optimized",
      "Strengthened",
      "Enhanced",
      "Streamlined",
      "Transformed",
    ],
    note: "Improved is acceptable, but a more specific verb often sounds sharper and more credible.",
  },
  {
    weak: "managed",
    replacements: ["Directed", "Oversaw", "Led", "Administered", "Coordinated"],
    note: "Managed is common and sometimes repetitive. Swap it when a more specific leadership verb fits better.",
  },
  {
    weak: "supported",
    replacements: [
      "Enabled",
      "Facilitated",
      "Strengthened",
      "Advanced",
      "Improved",
    ],
    note: "Supported can work, but it often hides the real impact. Use the verb that names your contribution more directly.",
  },
  {
    weak: "helped with",
    replacements: [
      "Supported",
      "Coordinated",
      "Implemented",
      "Delivered",
      "Facilitated",
    ],
    note: "Helped with sounds tentative. State the exact action you took instead.",
  },
  {
    weak: "was part of",
    replacements: [
      "Collaborated",
      "Contributed",
      "Supported",
      "Executed",
      "Partnered",
    ],
    note: "Was part of focuses on membership, not impact. Replace it with the action you personally drove.",
  },
  {
    weak: "took part in",
    replacements: [
      "Contributed",
      "Collaborated",
      "Delivered",
      "Executed",
      "Presented",
    ],
    note: "Took part in weakens ownership. Show the verb that best describes your direct contribution.",
  },
  {
    weak: "dealt with",
    replacements: ["Resolved", "Managed", "Addressed", "Handled", "Processed"],
    note: "Dealt with sounds informal. Replace it with a verb that names the work more precisely.",
  },
  {
    weak: "was tasked with",
    replacements: ["Led", "Managed", "Executed", "Delivered", "Owned"],
    note: "Was tasked with focuses on assignment rather than action. Lead with the action you took.",
  },
  {
    weak: "tasked with",
    replacements: ["Led", "Managed", "Executed", "Delivered", "Owned"],
    note: "Tasked with still sounds indirect. Start with the action that shows what you accomplished.",
  },
  {
    weak: "exposed to",
    replacements: [
      "Applied",
      "Worked with",
      "Implemented",
      "Configured",
      "Analyzed",
    ],
    note: "Exposed to suggests observation rather than contribution. Use it only if that is genuinely all you did.",
  },
  {
    weak: "familiar with",
    replacements: ["Applied", "Implemented", "Operated", "Configured", "Used"],
    note: "Familiar with belongs in skills lists, not experience bullets. Use a verb that shows actual application.",
  },
  {
    weak: "tried",
    replacements: [
      "Tested",
      "Piloted",
      "Experimented",
      "Validated",
      "Evaluated",
    ],
    note: "Tried sounds uncertain. Replace it with the actual method you used to evaluate or test something.",
  },
  {
    weak: "learned",
    replacements: ["Mastered", "Applied", "Developed", "Acquired", "Completed"],
    note: "Learned is fine for training context, but experience bullets usually need a stronger action or outcome focus.",
  },
  {
    weak: "saw",
    replacements: ["Observed", "Identified", "Detected", "Recognized", "Found"],
    note: "Saw is conversational. Use a more professional verb that reflects what you noticed or discovered.",
  },
  {
    weak: "got",
    replacements: ["Secured", "Achieved", "Attained", "Won", "Obtained"],
    note: "Got is too informal for resume bullets. Use a verb that matches the result you achieved.",
  },
  {
    weak: "kept track of",
    replacements: ["Tracked", "Monitored", "Recorded", "Managed", "Maintained"],
    note: "Kept track of is wordy. A single precise verb reads more strongly.",
  },
  {
    weak: "worked with",
    replacements: [
      "Collaborated",
      "Partnered",
      "Coordinated",
      "Integrated",
      "Aligned",
    ],
    note: "Worked with is common but bland. Use a collaboration verb that shows how you engaged with others.",
  },
  {
    weak: "updated",
    replacements: ["Revised", "Refined", "Enhanced", "Modernized", "Upgraded"],
    note: "Updated can be too flat. Pick a verb that shows the level of change you made.",
  },
  {
    weak: "created",
    replacements: ["Developed", "Designed", "Built", "Produced", "Launched"],
    note: "Created is usable, but more specific build verbs often sound more credible and concrete.",
  },
  {
    weak: "worked",
    replacements: ["Executed", "Delivered", "Operated", "Performed", "Managed"],
    note: "Worked on its own says very little. Replace it with the exact action you performed.",
  },
  {
    weak: "organized",
    replacements: [
      "Coordinated",
      "Planned",
      "Structured",
      "Arranged",
      "Scheduled",
    ],
    note: "Organized is common and broad. Use a more specific verb if you planned, scheduled, or coordinated something.",
  },
  {
    weak: "ran",
    replacements: ["Led", "Managed", "Operated", "Directed", "Executed"],
    note: "Ran can be too conversational. Use a clearer leadership or execution verb where possible.",
  },
]

function toCanonicalVerb(verb: string) {
  return verb.trim().toLowerCase()
}

const actionVerbIndex = new Map(
  ACTION_VERB_DICTIONARY.map(
    (entry) => [toCanonicalVerb(entry.verb), entry] as const
  )
)

export const WEAK_ACTION_VERB_DICTIONARY: WeakActionVerbEntry[] =
  RAW_WEAK_ACTION_VERBS.map((entry) => {
    const deduped = Array.from(
      new Set(
        entry.replacements.filter((replacement) =>
          actionVerbIndex.has(toCanonicalVerb(replacement))
        )
      )
    )

    return {
      weak: entry.weak,
      replacements: deduped,
      note: entry.note,
    }
  }).sort((left, right) => left.weak.localeCompare(right.weak))
