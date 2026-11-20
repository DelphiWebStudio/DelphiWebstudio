# Changing page names and addresses

Last changed: November 20, 2026. Version 1.0.0 build 3.

A page name identifies the page in the editor. Its address identifies the destination used by website links and determines its exported filename. These values can be changed together in **Page settings** while keeping the page's content and design in place. Search descriptions remain under the separate **Search details** command.

## Change an address

1. Select the page with its tab or **Go to page**.
2. Choose **Page tools → Page settings**, click the chain-link icon, or right-click the page tab. With keyboard focus on a tab, **Shift+F10** also opens its settings.
3. Leave **Page name** unchanged if you only want a new address. Change **Page address**, for example from `/about` to `/about-us`. Entering `about-us` also works; the editor supplies the leading slash.
4. Inspect **Resulting address** and **Exported filename**. With the current static export format, `/about-us` produces `about-us.html`; this does not configure an extensionless address on a hosting server.
5. Leave **Update links within this website** selected. Expand **Review … link references** to see the affected pages and any saved reusable sections.
6. Choose **Save page settings**, then review the page in Preview. Export or refresh the local website to obtain its new file and navigation.

Supported text, image, button, Navbar, submenu and Footer links are updated together. Query details and anchors are retained: `/about?from=home#visit` becomes `/about-us?from=home#visit`. Menu wording and grouping are not changed automatically. Links in custom code, full website addresses and bookmarks outside the project require separate review.

## Related addresses and Undo

Changing `/about` leaves `/about/history` unchanged by default. To change that address too, select **Also change related page addresses** and review the listed old and new paths. This is independent of submenu grouping: a submenu can continue to point to a page whose address is different from its parent page's address.

The editor checks for duplicate, unsafe and Windows-reserved paths before saving. If validation fails, the proposed settings and link updates are not committed. The Home address remains `/` and exports as `index.html`, although its displayed page name can be edited.

One **Undo** reverses the entire saved name/address operation, the requested related-address changes and its supported link updates. **Redo** reapplies the same operation. A published website is unchanged until you export and separately upload the new files. Changing a project address does not create a server redirect for the old public URL.
