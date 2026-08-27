# Hebrew Image OCR Specification

**Version:** 2.3.0
**Purpose:** Standard first-pass Hebrew OCR with optional authoritative physical-line count

## Purpose

Create a faithful visual transcription of the supplied Hebrew image in Unicode form for later review and editing.

This is a standard OCR transcription pass.

The image itself is the source of Hebrew content. Do not reconstruct, modernize, spell-correct, translate, transliterate, or complete familiar Hebrew from memory.

A physical-line count may be supplied separately by the calling application.

---

# Physical Line Count

The calling application may provide one of two conditions.

## Expected line count supplied

If the request states that the image contains exactly **N physical Hebrew lines**, where N is 1 or greater:

1. Treat N as authoritative structural information.
2. Return exactly N objects in the `lines` array.
3. Identify the N physical printed Hebrew lines from top to bottom.
4. Do not merge two physical lines.
5. Do not split one physical line into multiple output lines.
6. Do not omit a short or indented line.
7. Do not invent Hebrew text merely to satisfy the count.
8. If recognition of a particular line is uncertain, still preserve that physical line as its own line object and transcribe only what can be visually determined.

The supplied line count controls structure only. It does not supply or imply any Hebrew content.

## Line count not specified

If the request explicitly states that the physical line count is not specified:

1. Determine the number of complete physical Hebrew lines visually.
2. Preserve each physical printed line as one `lines` object.
3. Inspect the complete image from top to bottom.
4. Pay particular attention to short, indented, or unusually spaced lines.
5. Do not assume all lines have the same left edge, right edge, or length.

---

# Physical Line Identification

Identify a physical line primarily from the horizontal band of its complete Hebrew base-letter bodies.

Niqqud, trope, Meteg/Silluq, and other combining marks may extend above or below those base letters and may visually approach marks from neighboring lines.

Do not merge adjacent lines merely because their diacritic regions overlap.

A physical line may begin with substantial horizontal white space, end with substantial horizontal white space, be much shorter than adjacent lines, or be indented differently from surrounding lines.

Horizontal margins do not determine whether a line exists.

---

# Fundamental Transcription Rule

**WYSIWYG — transcribe what is visibly printed.**

Only visible printed content may appear in the Hebrew transcription.

Do not reconstruct familiar prayer text, correct spelling, fill in expected words, copy text from another line, expand abbreviations, normalize sacred names, or infer missing vowels or trope.

Visual evidence controls the transcription.

---

# Word Segmentation

Within each physical line, return every visibly space-separated Hebrew word as a separate object in the `words` array.

A normal `hebrew` value must not contain an inter-word space.

Example:

```json
{
  "words": [
    { "hebrew": "WORD1", "translit": "" },
    { "hebrew": "WORD2", "translit": "" },
    { "hebrew": "WORD3", "translit": "" }
  ]
}
```

Do not return:

```json
{
  "words": [
    { "hebrew": "WORD1 WORD2 WORD3", "translit": "" }
  ]
}
```

## Maqaf

Text visibly joined by Hebrew Maqaf U+05BE remains in one word object.

## Paseq

Preserve visible Paseq U+05C0 according to the printed spacing.

## Punctuation

Visible comma, period, colon, semicolon, Sof Pasuq, quotation marks, Geresh, Gershayim, and similar punctuation remain associated with the visible word/location where printed.

---

# Hebrew Unicode Recognition

Preserve every visible Hebrew base letter, niqqud, dagesh/mappiq, shin/sin distinction, cantillation/trope mark, Meteg/Silluq, Maqaf, Paseq, Sof Pasuq, and punctuation mark.

Do not translate or transliterate in this pass.

Every `translit` value must remain exactly `""`.

---

# Editor-Oriented Unicode Rules

These encoding rules are intentional for the review editor.

## Shin and Sin

Use U+FB2A `שׁ` for Shin with Shin Dot and U+FB2B `שׂ` for Sin with Sin Dot.

## Shuruk

Use U+FB35 `וּ` rather than decomposed Vav + Dagesh when the visible form is Shuruk.

## Holam Male

Use U+FB4B `וֹ` when the visible form is Holam Male.

## Consonantal Vav with Holam

When Vav is consonantal and carries Holam, use U+05D5 followed by U+05BA.

## Dagesh / Mappiq

Except for atomic Shuruk, preserve U+05BC as a separate combining mark.

## Hataf vowels

Preserve U+05B1 Hataf Segol, U+05B2 Hataf Patach, and U+05B3 Hataf Qamatz as atomic marks.

## Compatibility normalization

Do not apply NFKC or NFKD to the editor-oriented presentation forms above.

---

# Meteg / Silluq

Preserve a clearly visible Meteg/Silluq as U+05BD.

A Meteg/Silluq may coexist with another vowel on the same Hebrew base letter.

If both are visibly present, preserve both combining marks.

Do not confuse U+05BD with Hataf Segol, Hataf Patach, or Hataf Qamatz.

Do not infer a Meteg/Silluq solely from grammar or familiarity with the text.

This first OCR pass should preserve visible Meteg/Silluq when recognized, but no separate Meteg-only verification pass is part of this specification.

---

# Sacred Names and Abbreviations

Transcribe sacred names and abbreviations exactly as visibly printed.

If the image contains `יי`, preserve `יי`.

Do not expand it to `יהוה`.

Do not insert Geresh or Gershayim unless visibly printed.

---

# Required JSON Output

Return only:

```json
{
  "title": "<filename without extension>",
  "lines": [
    {
      "lineName": "Line1",
      "words": [
        {
          "hebrew": "",
          "translit": ""
        }
      ]
    }
  ]
}
```

Requirements:

- `title` is the source filename without extension.
- `lineName` values are sequential: `Line1`, `Line2`, ... .
- Each physical Hebrew line gets exactly one line object.
- Each visibly separated Hebrew word gets exactly one word object.
- Every `translit` value is exactly `""`.
- Do not include geometry boxes, confidence values, explanations, notes, markdown, or commentary.

---

# Final Validation

Before returning JSON:

1. If an expected physical line count N was supplied, verify `lines.length === N`.
2. If the line count was not specified, recount the physical Hebrew lines visually and verify the returned array matches that count.
3. Verify every physical line appears exactly once and in top-to-bottom order.
4. Verify short and indented lines were not omitted.
5. Verify adjacent lines were not merged.
6. Verify no line was reconstructed from a familiar text.
7. Verify every visibly separated word has its own `words` object, subject only to Maqaf/Paseq behavior.
8. Verify ordinary `hebrew` values do not contain inter-word spaces.
9. Verify every `translit` value is exactly `""`.
10. Recheck visible niqqud and cantillation.
11. Preserve any clearly visible Meteg/Silluq U+05BD, including when another vowel is present on the same base letter.
12. Verify no Hataf vowel was reinterpreted as Meteg/Silluq.

Return the JSON object only.
