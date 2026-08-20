Developer: Ari Rapkin Blenkhorn (<a href="mailto:ari@acm.org">ari@acm.org </a>) <br>
Proof-of-concept (Unity Editor demo) - October 2024 <br>
MoYa 1.0 (Javascript) - ongoing

This is work in progress, under active development. Feedback is encouraged from yarncrafters, software developers, and especially people who are both! If you know someone who'd be interested in trying it out and providing feedback, please have them contact me. Don't distribute the code on your own. Thank you!

<hr>
<p>
My goal is to provide a tool for yarn-crafters (crocheters, knitters, and related crafts) to design patterns which can be used for the <b><i>mosaic</i></b> technique in any of these crafts. I started writing this because I knit and crochet, I wanted this tool,  it didn't exist yet, and it seemed like a fun challenge.
</p>
<p>        
Mosaic yarn-craft patterns are worked in two contrasting colors of yarn. Unlike many other multi-color yarn-craft techniques, mosaic uses only one color per row, alternating rows. The crafter does not have to carry unused yarns along the back of a row, or manage numerous yarn bobbins, or switch colors mid-row. The tradeoff is that the mosaic technique requires patterns which comply with certain color placement restrictions. Designing compliant patterns is difficult, and existing craft pattern design tools are insufficient. Many patterns are aggregations of small motifs which can be manually designed and checked. Only a few designers produce large non-repetitive patterns, commonly using digital spreadsheets or physical pencils and graph paper. These methods are tedious and error-prone.
</p> 

What are those restrictions?<br>
<p>
As noted above, each row uses only one color of yarn. Unless otherwise specified, a stitch is made in the designated color for that row. Following this rule everywhere produces a pattern which is nothing but narrow horizontal stripes -- easy to stitch, but boring! To create more interesting designs, it's necessary to make a stitch which is the wrong color for its row, e.g. a black stitch in a white row. For the mosaic technique, the stitches above and below (the <i>anchor stitches</i>) must match it, as it is created by creating a long stitch which connects the anchor stitches. Therefore the anchor stitches must also be the correct color for their rows. (Unless they're <i>all</i> "wrong", in which case we look at the stitches above and below the entire group. And so on.) 
</p> <p> 
Depending on the specific craft and method of mosaic stitching, either the lower anchor stitch is modified by extending it upward across the intervening row, or the upper anchor stitch is modified by extending it downward. In some crafts, the "wrong" stitch is also modified by skipping it or making a different type of stitch. 
</p> <p> 
This application supports pattern display with upper or lower anchor stitches marked, corresponding to the designer's intended craft method, or they can be displayed with no anchor stitches marked so that the pattern is craft-agnostic. (Future: mark "wrong" stitches for crafts which skip or modify them).
</p> <p> 
Patterns are commonly displayed and printed in black and white, and this is the most common color palette, but any sufficiently high-contrast pair of colors can be used with slightly different results. This application supports designing in black and white or user-specified colors.
</p> 
<b>Features:</b>
				<ul>
				<li>Set the size of your chart in stitches and rows, for a chart that can be used for any craft. 
					Or set it in physical inches based on your personal row/stitch 
					gauge in your chosen craft, and display with non-square stiches. </li>
        <li>Zoom (using scrollwheel or (i)n and (o)ut keys) and pan (using spacebar & mouse) to see your chart easily.</li>
				<li>To create your design, you can ... <br>
					-- Click to toggle stitches. Work one stitch at a time, or use a larger square "brush". <br>
					-- Create symmetric designs or mosaic-in-the-round by mirroring stitches from one drawing area to the rest of the image.<br>
				    -- Import an existing bitmap as your chart, then modify it.<br>
				    -- Import a background reference image, and draw over the reference image to create your chart.<br>
					-- Turn a reference image into a chart in one step with automatic algorithms such as threshholding and dithering.</li>
				<li>Check whether your chart is valid for mosaic yarn-crafting. Red squares indicate invalid stitches. Visual feedback updates as you modify the design.</li>
				<li>Display your chart in black and white (the default) or set your palette to reflect the actual yarns being used.</li>
				<li>Save your chart as a simple pixel map. Or add row and stitch numbers, chart markings (for anchor stitches), and row-color indicators, and save as image or PDF. (Current bug: anchor stitch markings in PDF are blurry. If using markings, use Save Chart as Image. </li>
				</ul>

<hr>
<p>
This application is a self-contained web-browser application intended to run on your machine. Nothing is uploaded or downloaded to any servers, databases, etc.  All images and charts that you create exist only on your machine. No AI is used to create, validate, or modify your designs. (I do use generative AI assistants to help write the application.)
</p><p>
To obtain and set up the application, simply clone or download the repo, then load the main HTML page in your browser. I have been using Chrome almost exclusively, and would appreciate hearing whether it works on other browsers, or how it fails.
