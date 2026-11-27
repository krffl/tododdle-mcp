# Page picture slots

These sizes follow how the hosted pages show each picture and how ToDoddle resizes uploads (page art is stored as WebP up to 1600 px; the logo up to 1024 × 512 px; the favicon at 64 × 64 px). ToDoddle shows the same sizes, tips and sample pictures next to each upload field in the page editor. Every upload must be a static PNG, JPEG or WebP image up to 5 MB.

| Slot (label in the editor) | File name | Size | Format and background | How it is shown |
| --- | --- | --- | --- | --- |
| Logo | `logo.png` | 1200 × 400 px | PNG, transparent, trimmed close to the edges | Page header, up to 48 px tall |
| Favicon | `favicon.png` | 512 × 512 px | PNG, transparent or solid, bold simple mark | Browser tab, 16–32 px |
| Background | `background.jpg` | 1920 × 1080 px | JPEG or WebP, full | Behind the whole page, cropped at the edges; must stay quiet |
| Release hero ("What’s new hero") | `release-hero.jpg` | 1600 × 1000 px | JPEG or WebP, full | Beside the Home heading, cropped from the centre |
| Support hero ("Get help hero") | `support-hero.jpg` | 1600 × 1000 px | JPEG or WebP, full | Beside the Support heading, cropped from the centre |
| Testbench hero ("Testbench hero") | `testbench-hero.jpg` | 1600 × 1000 px | JPEG or WebP, full | Beside the Testbench heading, cropped from the centre |
| Release banner ("Latest release image") | `release-banner.jpg` | 1600 × 640 px | JPEG or WebP, full | A wide band across the newest release, cropped from the centre |
| Empty state ("Nothing here yet") | `state-empty.png` | 512 × 512 px | PNG, transparent | 88 px, cropped to a square |
| Success state ("Success") | `state-success.png` | 512 × 512 px | PNG, transparent | 88 px, cropped to a square |
| Error state ("Something went wrong") | `state-error.png` | 512 × 512 px | PNG, transparent | 88 px, cropped to a square |
| Workspace card ("Workspace page card") | `card.jpg` | 1200 × 750 px | JPEG or WebP, full | This project's card on the workspace front page, cropped to 16:10 |

Hero pictures fill a box 200–340 px tall: full width on phones (very wide), about half the page on desktop. Keep the subject in the centre half both ways.

## Upload checklist

In ToDoddle, open the project, then **Project settings → Public pages**. Project owners and admins can do this.

1. **Brand → Logo, colours and links:** Logo, Favicon, Background image. Check the theme and colours here too.
2. **Brand → Shared pictures:** Nothing here yet, Success, Something went wrong, and Workspace page card. Every page shares these.
3. **Home → Pictures:** What’s new hero and Latest release image.
4. **Support → Pictures:** Get help hero (only if Support is on).
5. **Testbench → Pictures:** Testbench hero (only if Testbench is on).
6. Press **Publish changes**. Nothing is live until then. A replaced or removed picture is deleted after you publish.
7. Open the live page and check it at phone width. Clicking a picture in the editor preview opens its upload field.

Sample pictures for every slot are on each upload field ("Download sample") if the user wants to see the expected framing first.
