<script>
    import { onMount } from 'svelte';
    import { user } from './stores.js';

    let toggleProf = true;

    function switchToggle() {
        toggleProf = !toggleProf
    }
</script>

<div class="header">
    <!-- <div class={toggleProf ? "profile-container" : ""}>
        {#if $user?.id}
            {#if toggleProf}
            <a href="/">Home</a>
            <a href="/titles/auth/logout">Logout</a>
            {/if}
        <div class="profile-pic-container">
            <img class="profile-pic" src="{$user?.pic}" alt="Strava profile" on:keypress={switchToggle} on:click={switchToggle}>
        </div>
        {:else if Object.keys($user).length === 0}
        <a href="/titles/auth/login">
            <img class="ctxstrava" src="./ctxwstrava.png" alt="Connect with Strava">
        </a>
        {/if}
    </div> -->
</div>

<style>
    /* .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: fixed;
        right: 0;
        z-index: 401;
        margin: 10px;
    }
    .header a {
        color:#464646;
    }
    .logo {
        justify-self: center;
        color: #AE132A;
        font-size: 2rem;
        font-family: monospace;
        font-weight: bold;
        display: flex;
        align-items: end;
    }
    .profile-container {
        display: flex;
        align-items: center;
        border-radius: 5px 24px 24px 5px;
        border: 2px solid rgba(0,0,0,0.2);
        background-clip: padding-box;
        background-color: #ffffff;
        height: 48px;
        width: 200px;
        justify-content: space-between;
        padding-left: 4px;
    }
    .profile-container > a {
        margin-left: 10px;
    }
    .profile-pic {
        width: 48px;
        height: 48px;
        border-radius: 24px;
    }
    .profile-pic:hover {
        border: 2px solid rgba(0,0,0,0.2);
        transform: scale(1.2);
        transition: all 100ms;
    }
    .profile-pic-container {
        width: 48px;
        height: 48px;
        overflow: visible;
    }
    .sublogo {
        font-size: 1.2rem;
        margin-bottom: 4px;
    }
    .ctxstrava {
        height: min(48px, 10vw);
    }
    @media screen and (max-width: 470px) {
        .sublogo {
            display: none;
        }
    } */
</style>