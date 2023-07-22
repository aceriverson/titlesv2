<script>
    import { createEventDispatcher, onDestroy } from 'svelte';
    import {showMapTools} from './stores.js'

    $: $showMapTools ? showMapTools.set(false) : null;

    const dispatch = createEventDispatcher();

    function handleClose() {
        // Dispatch the custom event to the parent component
        dispatch("closePopUp");
    }

    onDestroy(() => {
        showMapTools.set(true);
    })

</script>

<div class="popup">
    <i class="ri-close-line close-button" on:click={handleClose} on:keydown={handleClose}></i>
    <slot name="header" />
    <div class=input>
        <slot name="message" />
        <slot name="input" />
    </div>
    <div class="buttons">
        <slot name="buttons" />
    </div>
</div>

<style>
    .input {
        display: flex;
        flex-direction: column;
    }
    .close-button {
        position: absolute;
        right: 20px;
        top: 20px;
    }
    .close-button:hover {
        transform: scale(1.2);
    }
    .popup {
        position: fixed;
        z-index: 1001;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #fff;
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 5px;
        padding: 20px;
        width: clamp(256px, 40vw, 450px);
        height: clamp(192px, 30vw, 350px);
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 1rem;
        justify-content: space-between;
    }
    .buttons {
        margin-left: auto;
    }
</style>