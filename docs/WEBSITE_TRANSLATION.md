# Automatic website translation

Last changed: November 19, 2026.

Website translation gives visitors a floating language selector on every exported page. It uses GTranslate, the online website translation service already used by the VCL2FMXConverter Atlas website. The preset automatically detects the visitor's browser language and offers 35 languages. English names and native names appear together in an alphabetically sorted list, and right-to-left languages receive the appropriate page direction.

## Enable it once for the website

Open your project, choose Settings, and open Project settings. Select **Website translation**, return to the Editor, then save the project. There is no additional language list to choose or maintain. The existing Language setting continues to identify the original language of the page; English is the default for an English project.

Open Export and choose **Review files**. In the Windows edition, choose **Open reviewed site in browser** to try the exact exported website locally. Keep the editor running while using that temporary address. The floating selector sits on the right and allows visitors to change the automatically selected language or return to English. Follow links to other pages to check that the choice continues through the site. **Stop local preview** ends the temporary server and removes its temporary ZIP.

The editor canvas and its toolbar Preview retain the original wording. The external service runs in the website browser, outside the privileged editor. Translation does not rewrite saved text, use Gemini or require a Gemini API key. Selecting the option does not upload or publish the website.

The downloaded website ZIP includes the selector on ordinary pages, nested pages and generated article/search pages. Keep its assets folder with the pages when copying the export to a server. To remove translation, clear the option, export again and replace the deployed files with that new export. Clearing the option in a project does not alter a site that was already deployed.

## Built in languages

The preset offers the following 35 languages. The visitor sees English and native names together, sorted alphabetically. The website owner does not choose or maintain this list. Chinese Simplified and Chinese Traditional are separate choices; the Filipino entry uses the provider's `tl` code.

Arabic, Bangla, Bulgarian, Chinese Simplified, Chinese Traditional, Croatian, Czech, English, Filipino, Finnish, French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Pashto, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Spanish, Swedish, Thai, Turkish, Ukrainian, Urdu and Vietnamese.

## Service requirements and limits

GTranslate loads its widget and processes page text through online translation services, so translation needs an internet connection and JavaScript. The original content remains readable if the service cannot load. Translations are machine-generated and can contain mistakes; visitors can return to the original language. Text inside photographs or scanned PDF documents is not translated by the webpage selector.

GTranslate's current free-use terms cover eligible personal, educational, internal testing, nonprofit and governmental use. Commercial or revenue-generating use requires a paid subscription. The editor does not enroll the owner in a paid plan or supply a shared service account. Review the provider's [terms](https://gtranslate.io/terms) and [privacy policy](https://gtranslate.io/privacy-policy) before enabling it for a site.

Website translation is off unless explicitly selected. Existing projects without the setting continue to export their original pages without the translation widget or helper. Turning it on saves one boolean setting, `websiteTranslation`, in the portable project.
