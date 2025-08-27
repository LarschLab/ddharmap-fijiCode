// preprocess_2p_anatomy_single_channel.ijm
// Purpose: For single-channel 2P anatomy stacks (no interleaved colors)
// Steps: (if T-stack) convert T→Z → duplicate → flip X → reverse Z → resize to 750×750 (keeps 16‑bit)
// Usage: Open your 16‑bit stack, then run this macro.
// Output: A duplicated, processed stack named "<original>_anatomy_preproc"

macro "Preprocess 2P Anatomy (single-channel)" {
    setBatchMode(true);

    // Basic sanity checks
    getDimensions(w, h, c, z, t);
    if (z==1 && t==1) exit("This image is not a stack (Z=1, T=1). Open a stack and try again.");
    if (bitDepth!=16) showMessage("Note","Input is "+bitDepth+"-bit, not 16-bit. Proceeding without conversion.");

    // If this is a T-stack (time series) with Z=1, convert T → Z first
    getDimensions(w, h, c, z, t); // returns c,z,t
    if (t>1 && z==1) {
        // Convert linear stack into a hyperstack where frames become slices
        // After this call: z := old t, t := 1
        run("Stack to Hyperstack...", "channels="+c+" slices="+t+" frames=1 display=Grayscale");
        getDimensions(w, h, c, z, t); // refresh dims
    }

    // Duplicate so we never touch the original
    origTitle = getTitle();
    outTitle  = "preproc_" + origTitle ;
    run("Duplicate...", "title="+outTitle+" duplicate");
    selectWindow(outTitle);

    // Flip in X (horizontal)
    run("Flip Horizontally");

    // Flip in Z by reversing slice order
    run("Reverse", "stack");

    // Resize XY to exactly 750×750 pixels (keeps Z-depth and bit-depth)
    getDimensions(w, h, c, z, t);
    if (w!=750 || h!=750) {
        run("Size...", "width=750 height=750 depth="+z+" average interpolation=Bilinear");
    }

    // Optional: reset display range so it doesn't inherit odd LUT windows
    resetMinAndMax();
    selectWindow(outTitle);

    setBatchMode(false);
    print("[Preprocess 2P Anatomy] Done → " + outTitle + " ("+w+"×"+h+"×Z"+z+")");
}
