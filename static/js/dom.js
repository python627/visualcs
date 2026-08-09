const stackDiv = document.getElementById("stack");
const message = document.getElementById("message");
const animationLayer = document.getElementById("animation-layer");

const controls = new Map(
    Array.from(document.querySelectorAll("[data-operation]")).map(control => [
        control.dataset.operation,
        control
    ])
);


function getControl(operation) {

    const control = controls.get(operation);

    if (!control) {
        throw new Error(`Missing control for operation: "${operation}".`);
    }

    return control;

}
