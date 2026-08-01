const stack = [];

const stackDiv = document.getElementById("stack");

const message = document.getElementById("message");

document.getElementById("pushBtn").onclick = push;

document.getElementById("popBtn").onclick = pop;

function render(){

    stackDiv.innerHTML="";

    stack.forEach(number=>{

        const block=document.createElement("div");

        block.className="block";

        block.innerText=number;

        stackDiv.appendChild(block);

    });

}

function push(){

    const value=Math.floor(Math.random()*90)+10;

    stack.push(value);

    render();

    message.innerHTML="You added "+value;

}

function pop(){

    if(stack.length===0){

        message.innerHTML="Stack is empty.";

        return;

    }

    const removed=stack.pop();

    render();

    message.innerHTML="You removed "+removed;

}