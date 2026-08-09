function getBlockElements() {
    return Array.from(stackDiv.children).filter(
        element => element.classList.contains("block")
    );
}


function captureBlockRects() {
    return getBlockElements().map(block => block.getBoundingClientRect());
}


function createAnimatedBlock(value, rect) {
    const layerRect = animationLayer.getBoundingClientRect();
    const block = document.createElement("div");

    block.className = "block";
    block.textContent = value;

    Object.assign(block.style, {
        position: "absolute",
        left: `${rect.left - layerRect.left}px`,
        top: `${rect.top - layerRect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "2",
        pointerEvents: "none",
        animation: "none"
    });

    animationLayer.appendChild(block);
    return block;
}


function animateBlockAddition(value, target) {
    const targetRect = target.getBoundingClientRect();
    const block = createAnimatedBlock(value, targetRect);
    const layerRect = animationLayer.getBoundingClientRect();
    const distanceFromTop = targetRect.top - layerRect.top + 90;

    target.style.visibility = "hidden";

    if (typeof block.animate === "function") {
        block.animate(
            [
                { opacity: 0, transform: `translateY(-${distanceFromTop}px)` },
                { opacity: 1, transform: "translateY(8px)", offset: .82 },
                { opacity: 1, transform: "translateY(0)" }
            ],
            { duration: 600, easing: "ease-out", fill: "forwards" }
        );
    }

    setTimeout(() => {
        block.remove();
        target.style.visibility = "";
    }, 600);
}


function animateRemainingBlocks(previousRects, offset) {
    const currentBlocks = getBlockElements();

    currentBlocks.forEach((block, index) => {
        const oldRect = previousRects[index + offset];

        if (!oldRect) return;

        const newRect = block.getBoundingClientRect();
        const deltaY = oldRect.top - newRect.top;

        block.style.animation = "none";

        if (deltaY !== 0 && typeof block.animate === "function") {
            block.animate(
                [
                    { transform: `translateY(${deltaY}px)` },
                    { transform: "translateY(0)" }
                ],
                { duration: 360, easing: "ease-out" }
            );
        }
    });
}


function animateBlockRemoval(value, removedRect, direction) {
    const block = createAnimatedBlock(value, removedRect);

    if (typeof block.animate === "function") {
        block.animate(
            [
                { opacity: 1, transform: "translate(0, 0) scale(1)" },
                {
                    opacity: 0,
                    transform: `translate(${direction.x}px, ${direction.y}px) scale(.85)`
                }
            ],
            { duration: 420, easing: "ease-in", fill: "forwards" }
        );
    }

    setTimeout(() => block.remove(), 420);
}
