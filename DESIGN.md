# Citizen client design

## Visual world

Citizen uses the welcoming, photo-led structure of America.gov, grounded in Nigerian public life. The landing page opens on a dark, rounded canvas with a large greeting and a six-image slideshow of Nigerian landscapes and public spaces. Each image is paired with a related example question in the main prompt. The header has a small Nigerian flag beside the text wordmark. Below the hero, large sans-serif statements alternate with a document illustration, question routes, and an election-led preview of the separately maintained mini apps.

The three mini app previews use original editorial photographs: a neutral polling scene, a quiet phone moment, and a festive Lagos evening. Dark gradients keep the overlaid labels and descriptions readable. These images are atmospheric illustrations, not records of a specific election, hotline service, or event.

## Typography

Newsreader is reserved for the landing hero greeting and its header wordmark. Inter carries the rest of the product: homepage sections, chat, admin, navigation, inputs, and body copy. Lower sections use clear, medium-weight sans-serif headings rather than repeated editorial serif type.

## Color and shape

Use the near-black `#0b0f10` for the outer canvas, deep forest `#092e25` for civic actions and surfaces, and warm cream `#f5f2eb` for reading. The hero and photograph have soft large corners; controls and content cards use small 6–11px corners. The illustrated question panel deliberately uses larger rounding.

## Layout and interaction

The first action is asking a question, either in the home prompt or from a suggestion. The slideshow changes image and example question together every seven seconds; its six controls allow direct selection, and automatic motion stops when the prompt is focused or reduced motion is requested. Submitting an empty prompt uses the currently shown example. A homepage question opens chat and submits automatically. The homepage then tells the story in this order: purpose, source process, common questions, planned mini apps, and limitations. Chat uses a narrow reading column, a quiet user bubble, plain answer text, source links, and a dark composer anchored below. Admin uses a quiet forest navigation rail and a bright, spacious work area.

Never draw visible divider rules or separator lines. Separate content with whitespace and surface changes. Keep touch targets, focus visibility, loading/error states, and mobile reading widths intact. The only Citizen brand is a text wordmark; no icon or pin mark.

## Product truth

The chat is restricted to Citizen’s approved document library. It must not claim to search news or the open web, fabricate document citations, or advertise an index count until one exists.
