// preprocess_2p_anatomy_single_channel.ijm
// Purpose: For single-channel 2P anatomy stacks (no interleaved colors)
// Steps: duplicate → flip X → reverse Z → resize to 750×750 px (keeps 16‑bit)
// Usage: Open your 16‑bit stack, then run this macro.
// Output: A duplicated, processed stack named "<original>_anatomy_preproc"

macro "Preprocess 2P Anatomy (single-channel)" {
    setBatchMode(true);

    // Basic sanity checks
    if (nSlices==1) exit("This image is not a stack (Z-depth = 1). Open a stack and try again.");
    if (bitDepth!=16) showMessage("Note","Input is "+bitDepth+"-bit, not 16-bit. Proceeding without conversion.");

    // Duplicate so we never touch the original
    origTitle = getTitle();
    outTitle  = origTitle + "_anatomy_preproc";
    run("Duplicate...", "title="+outTitle+" duplicate");
    selectWindow(outTitle);

    // Flip in X (horizontal)
    run("Flip Horizontally");

    // Flip in Z by reversing slice order
    run("Reverse", "stack");

    // Resize XY to exactly 750×750 pixels (keeps Z-depth and bit-depth)
    getDimensions(w, h, c, z, t);
    if (w!=750 || h!=750) {
        // Resample the stack with bilinear interpolation; average = slice averaging when downsampling
        run("Size...", "width=750 height=750 depth="+z+" average interpolation=Bilinear");
    }

    // Optional: bring to front and reset display
    resetMinAndMax();
    selectWindow(outTitle);

    setBatchMode(false);
    print("[Preprocess 2P Anatomy] Done → " + outTitle);
}
