// Set channel tool to Composite
Stack.setDisplayMode("composite");

// Move to middle slice
middleSlice = floor(nSlices / 2) + 1;
setSlice(middleSlice);

// Get image dimensions safely
width = 0; height = 0; channels = 0; slices = 0; frames = 0;
getDimensions(width, height, channels, slices, frames);

// Auto-adjust each channel individually
for (c = 1; c <= channels; c++) {
    Stack.setChannel(c);
    run("Enhance Contrast", "saturated=0.35");
}
