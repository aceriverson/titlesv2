<script>
    import { slide } from 'svelte/transition';
    import { showMapTools, mapLocation, user } from './stores.js';

    let sideBarOpen = false;

    function toggleSideBar() {
        showMapTools.set(!$showMapTools)
        sideBarOpen = !sideBarOpen
    }

    let searchTerm = "";
    let isBadInput = false;

    async function searchFor(e) {
        isBadInput = false;
        if (e.type == 'click' || e.keyCode == 13) {
            try {
                const data = await fetch(`https://geocode.maps.co/search?q=${searchTerm}`);
                const json = await data.json()
                if (json.length > 0) {
                    isBadInput = false
                    mapLocation.set([json[0].lat, json[0].lon])
                    searchTerm = ""
                    toggleSideBar();
                } else {
                    isBadInput = true
                }
            } catch {
                isBadInput = true
            }
        }
    }
</script>

<div class="sidebar">
    {#if sideBarOpen}
    <div class="open-sidebar" in:slide={{ axis: 'x', duration: 100, delay: 50 }} out:slide={{ axis: 'x', duration: 100}}>
        <div class="sidebar-top">
            <div class="close-sidebar">
                <i class="ri-arrow-right-s-line" on:click={toggleSideBar} on:keypress={toggleSideBar}></i>
                <div style="display: flex; align-items: center; font-family: monospace; margin-right: 5px;">
                    acer.fyi/
                    <div style="font-size:24px; margin-top: 5px;">
                        titles
                    </div>
                </div>
            </div>
            <div class="location-search">
                <div class="location-search-bar-container">
                    <label for="location-search">Find on map:</label>
                    <div class="location-search-bar">
                        <input name="location-search" type="search" placeholder="1200m Loop" bind:value={searchTerm} class:bad-input={isBadInput} on:keypress={searchFor}>
                        <i class="ri-search-2-line location-search-button" on:click={searchFor}></i>
                    </div>
                </div>
            </div>
            <div class="routes" style="width: 100%; height: 200px">
            </div>
        </div>
        <div class="sidebar-bottom" style="width: 100%">
            <a href="/titles/auth/logout">
                <i class="ri-logout-box-r-line"></i>
            </a>
        </div>
    </div>
    {:else}
    <div class="closed-sidebar" in:slide={{ axis: 'x', duration: 200, delay: 100 }} out:slide={{ axis: 'x', duration: 200}}>
        {#if $user?.id}
            <div class="profile-pic-container" on:click={toggleSideBar} on:keypress={toggleSideBar}>
                <img src={$user?.pic || ""} class="profile-pic" alt="Strava Profile">
            </div>
        {:else}
            <div class="ctxwstrava-container">
                <a href="/titles/auth/login">
                    <img src="./ctxwstrava.png" class="ctxwstrava" alt="Connect with Strava">
                </a>
            </div>
        {/if}
    </div>
    {/if}
</div>

<style>
    .bad-input {
        border: 2px solid red;
    }
    .close-sidebar {
        font-size: 32px;
        /* padding: 10px; */
        color: #fff;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
    }
    .close-sidebar > i:hover{
        transform: scale(1.2);
        color: #f4f4f4;
    }
    .closed-sidebar {
        margin: 10px;
    }
    .ctxwstrava {
        height: 48px;
    }
    .location-search-bar-container {
        display: flex;
        flex-direction: column;
        align-items: left;
    }
    .location-search-bar {
        display: flex;
        flex-direction: row;
        margin-top: 2px;
    }
    .location-search-button {
        background-color: #fff;
        margin-bottom: 0.5rem;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 2px;
        padding: .4em;
        color: black;
        border-left: 0px;
        border-radius: 0px 2px 2px 0px;
    }
    .location-search-button:hover {
        background-color: #f4f4f4
    }
    .location-search-bar > input {
        border-right: 0px;
        border-radius: 2px 0px 0px 2px;
    }
    .location-search-bar > input:focus {
        outline-color: #AE132A !important;
    }
    .location-search {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 10px 0px;
    }
    .open-sidebar {
        width: 384px;
        background-color: #AE132A;
        color: #fff;
        border-left: 2px solid rgba(0,0,0, 0.2);
        height: 100vh;
        position: fixed;
        right: 0;
        top: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .profile-pic {
        width: 48px;
        height: 48px;
        border-radius: 28px;
        border: 2px solid rgba(0, 0, 0, 0.2);
    }
    .profile-pic:hover {
        transform: scale(1.2);
    }
    .sidebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: fixed;
        right: 0;
        z-index: 401;
    }
    .sidebar-bottom {
        width: 100%;
        color: #fff;
        font-size: 32px;
        display: flex;
        flex-direction: row-reverse;
    }
    .sidebar-bottom > a {
        margin: 0px 5px 5px 0px;
        color: #fff;
        text-decoration: none;
    }
    .sidebar-bottom > a:hover {
        transform: scale(1.2);
        color: #f4f4f4;
    }
    @media screen and (max-width: 512px) {
        .open-sidebar {
            width: 100vw;
        }
    }
</style>