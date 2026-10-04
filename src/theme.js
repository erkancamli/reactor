// runs before the stylesheet so the page never flashes the wrong theme
(function(){try{var t=localStorage.getItem("rx.theme");t=t?JSON.parse(t):null;if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})();
