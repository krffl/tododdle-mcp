---
name: tododdle-page-graphics
description: Plan, make, check and hand over the pictures for a project's hosted ToDoddle pages (release notes home, Support portal, Testbench and the workspace page card) as one matching set. Trigger when the user asks for graphics, art, images, a logo set, hero pictures or a brand pack for their ToDoddle public pages, page editor or portal, or says setting up those pages is slow. Do not trigger for ordinary ticket work or for in-app UI design.
---

# ToDoddle Page Graphics

A project's hosted pages use up to 11 pictures. People find the setup slow because each slot has its own size and crop, and pictures made one at a time do not match. This skill makes the whole set in one pass, in one style, at the right sizes, and tells the user exactly where each file goes.

Slot sizes, crops and upload places are in [references/slots.md](references/slots.md). Read it before you plan.

## Rules

- **Never invent a logo.** The logo and favicon come from the user's real logo files. If they have none, say so and leave those slots for them; the pages work without a logo (they show the project name).
- **No words in pictures.** Page text, headings and buttons come from the page editor, in any language. Pictures with text clash with it and cannot be translated. Ask every generator for "no text, letters, logos, watermarks or frames".
- **One style for the whole set.** Write a style card first (below) and use it, word for word, in every prompt.
- **Only the slots in use.** Ask which pages are on: Home (release notes), Support, Testbench, the workspace card. Skip the rest.
- **No real people, brands or trademarks** in generated pictures, and nothing that looks like a screenshot of another product.
- **Follow the environment's image rules.** If the user's instructions say how images are made (a tool, a quota, a booking step, where files go), follow them. Large raw files and drafts do not go in a code repository.
- **The user publishes.** You prepare files and a checklist. The user uploads them in the page editor and presses **Publish changes**. Do not sign in or upload for them.

## Steps

### 1. Gather the brand

Ask only for what you cannot find:

- Project name and what it is, in one sentence (the audience matters: players, shoppers, developers).
- Brand colour. In ToDoddle it is the project colour (Project settings → Public pages → Brand). Ask for the hex value.
- Light or dark page theme (Brand → Logo, colours and links → Theme).
- The real logo files (a wide logo and a square mark), if any.
- The pages in use, and any picture they already like.
- A style wish, if they have one (for example flat illustration, soft 3D, painterly, photo).

### 2. Write the style card

Write 4–6 short lines and show them to the user before you make anything:

```
Medium: soft flat illustration with gentle grain
Palette: brand orange #F97316, deep navy #0F172A, warm cream #FFF7ED; one accent only
Light: soft, from the upper left; no harsh shadows
Motif: paper planes and simple stars (recurs in every picture)
Mood: calm and friendly
Avoid: photo realism, anime, neon, clutter, text of any kind
```

Choose the palette from the brand colour plus one or two neutrals that suit the page theme. On a dark theme, keep backgrounds dark and let the accent carry the colour; on a light theme, the reverse.

### 3. Plan the set

Make a table of the slots in use, from [references/slots.md](references/slots.md): file name, pixel size, format, background (transparent or full) and one line of subject. Give every picture a different subject that fits its page:

- **Release hero:** something being built or launched.
- **Support hero:** help, conversation, a friendly guide.
- **Testbench hero:** trying something early, a lab or workbench feel.
- **Release banner:** a wide calm scene; it sits under the newest release.
- **Empty, success and error art:** one simple object each (an empty box, a check or a thumbs-up, a small cloud with a bolt), the same object style in all three.
- **Workspace card:** a small version of the project's world; it must read at card size.
- **Background:** very quiet texture or soft shapes in near-page colours. Text must stay readable on it.

Confirm the plan, the number of pictures and any cost or quota with the user before you generate.

### 4. Make the pictures

For each slot, the prompt names: the style card, the subject, the exact pixel size and aspect, the background ("fully transparent" for state art), the safe area ("keep the subject in the centre half; edges get cropped"), the size it will be seen at, and "no text, letters, logos, watermarks or frames". Pass the brand logo or an approved picture from the set as a style reference when the generator supports it, so later pictures match earlier ones.

Make the hero pictures first and check they match before you make the rest.

### 5. Fit and check

- Crop and resize to the exact size in the slot table. Use whatever is installed (`sips` on macOS, ImageMagick, `sharp`, or `ffmpeg`), and keep the subject centred.
- Check each file: the size is exact, the format is PNG, JPEG or WebP, it is under 5 MB, and state art and the logo have transparent corners.
- Check the crops. Hero pictures are cropped to cover a box 200–340 px tall that is wide on phones and about half the page on desktop. The subject must survive a crop to the centre half in both directions. State art is shown at 88 px; it must still read at that size.
- Check readability. Put the page heading colour on the background picture and confirm the text is still easy to read.
- Make one contact sheet (all pictures on one image, each labelled with its slot) so the user can approve the set at a glance.

### 6. Hand over

Give the user:

1. The contact sheet.
2. The folder of final files, named by slot.
3. The upload checklist from [references/slots.md](references/slots.md), only for the slots you made, in click order.
4. A reminder: press **Publish changes** in the page editor, then open the live page and check it on a phone width.

Keep the style card and prompts next to the files so the set can be extended later in the same style.
