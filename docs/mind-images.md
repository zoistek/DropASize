# Mind illustrations on the current test site

Based on test commit 7b08a48, including Claude's current design and functionality.
Only the nine EFT point demonstrations and Calm Anchor finger-action steps gain
illustrations. Meditation, guided relaxation, Craving Crusher, Future You,
breathing circles and other Mind tools remain unchanged.

Ten before/after pairs are generated once with the existing exercise-art GitHub
workflow and its VOICE repository secret. The same Gemini image model receives
actual goblet-squat training images as style references. Point lessons use a
closer knees-up view, black outlines, light-grey shading, lime-green shorts and
white backgrounds. Each second frame uses its first frame as an extra reference.
Mind images bypass floor-line alignment so close views are not shifted/cropped.
The bounded only.txt list includes only these ten sets; completed files are
skipped on rerun. Members opening a lesson never trigger image generation.

The existing NtExercise component displays the pairs with its existing pause,
reduced-motion, frame selection and enlargement controls. Images are WebP and
loaded from the same hosted assets as training art. All explanatory point labels,
voice prompts, navigation, repetitions and session completion stay intact.

Verification: node tools/tests/mind-images.test.js checks the nine point mappings,
Calm Anchor placement only on finger-action steps and no illustrations in the
other visualisation exercises. Related custom-training, Today and Android checks
also pass. Generated illustrations require visual review of anatomy and contact
positions; two frames illustrate placement, not a precise tapping-rate video.

Revert the Mind UI commit to remove the images from lessons; generated files may
remain safely unused. Main and APK releases are not changed by this test work.
