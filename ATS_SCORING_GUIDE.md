# ATS Scoring Feature Documentation

## Overview

The ATS (Applicant Tracking System) Scoring feature provides comprehensive resume analysis against job descriptions, helping users understand how well their resume will perform in automated screening systems.

## Features

### 1. Comprehensive Scoring (100 Points)

The system evaluates resumes across 5 key categories:

- **Keyword Match (30 points)**: Analyzes how well your resume matches keywords from the job description
- **Formatting & ATS Compatibility (20 points)**: Checks for ATS-friendly formatting
- **Content Quality (25 points)**: Evaluates achievement quantification and relevance
- **Professional Summary (10 points)**: Assesses the quality of your summary section
- **Experience Section (15 points)**: Reviews work experience using STAR method

### 2. Rating System

- **90-100**: Excellent - Highly likely to pass ATS
- **80-89**: Very Good - Strong resume, minor improvements needed
- **70-79**: Good - Solid foundation, several improvements recommended
- **60-69**: Fair - Needs significant optimization
- **Below 60**: Poor - Major revisions required

### 3. Detailed Analysis

#### Overview Tab

- Strengths and weaknesses summary
- ATS compatibility score with parseability percentage
- Critical issues and warnings

#### Issues Tab

- Detailed list of all issues found
- Severity levels: Critical, High, Medium, Low
- Each issue includes:
  - Category and severity
  - Impact explanation
  - How to fix with examples
  - Expandable details

#### Keywords Tab

- Keyword match percentage
- Keyword density analysis
- Present keywords (matched from JD)
- Missing keywords (should be added)
- Overused keywords (may trigger spam filters)
- Underused keywords (need more mentions)

#### Recommendations Tab

- Prioritized action items (High, Medium, Low)
- Expected benefit for each recommendation
- Implementation guidance
- Expandable details for each tip

## How to Use

### Step 1: Enter Your Information

1. Paste or upload your resume
2. Paste the job description you're applying for
3. Click the "ATS Score" button at the top

### Step 2: Get Your Score

1. Click "Get ATS Score" button
2. Wait 10-15 seconds for analysis
3. View your overall score and rating

### Step 3: Review Analysis

Navigate through the tabs:

- **Overview**: Quick summary of strengths/weaknesses
- **Issues**: Detailed problems with fixes
- **Keywords**: Keyword optimization analysis
- **Recommendations**: Actionable improvement tips

### Step 4: Improve Your Resume

1. Address critical and high-severity issues first
2. Add missing keywords naturally
3. Fix formatting issues
4. Improve quantification in achievements
5. Re-run the analysis to see improvements

## Scoring Methodology

### Keyword Matching

- Exact match (case-insensitive): 100% credit
- Synonym or variation: 75% credit
- Related term: 50% credit
- Missing: 0% credit

### Critical ATS Failures (Auto-deduct)

- Tables, columns, or text boxes: -15 points
- Contact info in header/footer: -10 points
- Images or graphics: -10 points
- Special characters or symbols: -5 points
- Inconsistent date formatting: -5 points
- Missing standard section headers: -8 points

### Quantification Requirements

Every work experience bullet should have:

- At least one number/metric
- Specific timeframe
- Clear impact statement

Missing quantification: -2 points per bullet (max -10)

### Action Verb Assessment

- Strong action verbs (Led, Achieved, Optimized): Full credit
- Weak verbs (Helped, Worked on, Responsible for): 50% credit
- Passive voice: 0% credit

## Common Issues and Fixes

### Issue: Low Keyword Match Score

**Problem**: Resume doesn't contain enough keywords from job description

**Fix**:

1. Extract key skills and technologies from JD
2. Add them naturally in your experience bullets
3. Include them in your skills section
4. Use exact terminology from the JD

**Example**:

```
Before: "Worked with cloud services"
After: "Architected AWS infrastructure using EC2, S3, and Lambda"
```

### Issue: Poor Formatting Score

**Problem**: Resume uses ATS-unfriendly formatting

**Fix**:

1. Remove tables and columns
2. Use standard section headers
3. Keep contact info in document body
4. Use simple bullet points (• or -)
5. Avoid images and graphics

### Issue: Missing Quantification

**Problem**: Achievements lack specific metrics

**Fix**:
Add numbers to every bullet:

```
Before: "Improved system performance"
After: "Improved system performance by 45%, reducing load time from 3s to 1.6s"
```

### Issue: Weak Action Verbs

**Problem**: Using passive or weak language

**Fix**:

```
Before: "Responsible for managing team"
After: "Led cross-functional team of 12 engineers"

Before: "Helped with project delivery"
After: "Delivered 15+ projects on time, achieving 98% client satisfaction"
```

## Best Practices

### 1. Keyword Optimization

- Target 2-4% keyword density
- Use primary keywords 3-5 times
- Use secondary keywords 2-3 times
- Integrate keywords naturally

### 2. Formatting

- Use standard fonts (Arial, Calibri, Times New Roman)
- Single-column layout
- Standard section headers
- Consistent date formatting (MM/YYYY)
- Left-aligned text

### 3. Content Quality

- Start bullets with strong action verbs
- Include metrics in every bullet
- Use STAR method (Situation, Task, Action, Result)
- Tailor content to job requirements

### 4. Professional Summary

- Include years of experience
- Mention 3-5 key skills from JD
- Add one quantified achievement
- Keep it 3-4 lines

## API Endpoint

### POST /api/ats-score

**Request Body**:

```json
{
  "jobDescription": "string",
  "resumeContent": "string"
}
```

**Response**:

```json
{
  "overallScore": 85,
  "categoryScores": { ... },
  "rating": "Very Good",
  "keyFindings": { ... },
  "detailedIssues": [ ... ],
  "recommendations": [ ... ],
  "atsCompatibility": { ... },
  "keywordAnalysis": { ... }
}
```

## Technical Details

### Model Used

- Default: `deepseek/deepseek-chat`
- Configurable via `OPENROUTER_MODEL` environment variable
- Temperature: 0.3 (for consistent scoring)
- Max tokens: 4000

### Processing Time

- Average: 10-15 seconds
- Depends on resume length and complexity

### Limitations

- Max resume size: 10MB
- Requires both resume and job description
- Analysis is AI-based and may vary slightly between runs

## Tips for Best Results

1. **Use Complete Job Descriptions**: Include all requirements and qualifications
2. **Provide Full Resume**: Don't truncate or summarize
3. **Run Multiple Times**: After making improvements, re-analyze
4. **Focus on High-Priority Issues**: Address critical and high-severity items first
5. **Balance Keywords**: Don't stuff keywords, integrate naturally
6. **Maintain Readability**: ATS score is important, but human readers matter too

## Troubleshooting

### Score seems too low

- Ensure you're using the exact job description
- Check if resume has proper formatting
- Verify all sections are included
- Look for missing keywords in the Keywords tab

### Analysis takes too long

- Check your internet connection
- Verify API key is configured
- Try with a shorter resume
- Check browser console for errors

### Results don't match expectations

- AI analysis may vary slightly
- Focus on specific issues identified
- Compare with ATS best practices
- Run analysis again after improvements

## Integration with Resume Generator

The ATS Score feature works seamlessly with the LaTeX Resume Generator:

1. Generate optimized resume using the Generator
2. Switch to ATS Score mode
3. Analyze the generated resume
4. Identify remaining improvements
5. Edit LaTeX and regenerate
6. Re-score to verify improvements

## Future Enhancements

Planned features:

- Historical score tracking
- Side-by-side comparison
- Industry-specific scoring
- Company-specific optimization (FAANG, etc.)
- Batch analysis for multiple JDs
- Export detailed reports
- Resume version comparison

---

**Last Updated**: 2024
**Version**: 1.0.0
