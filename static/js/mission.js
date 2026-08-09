let pushCount = 0;
let popCount = 0;


function updateMission() {

    const steps = document.querySelectorAll(".step");

    const actions = LESSON.playground.actions;

    const completedActions = pushCount + popCount;


    steps.forEach(step => {

        step.classList.remove("active");
        step.classList.remove("done");

    });


    steps.forEach((step, index) => {

        if (index < completedActions) {

            step.classList.add("done");

        }

        else if (index === completedActions) {

            step.classList.add("active");

        }

    });

}