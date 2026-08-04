/* ============================================================
   mistiCRAFT shared data layer — Supabase edition
   Products, artisans, orders, carts, wishlists & accounts used
   across the storefront and the workshop admin panel.

   Backed by Postgres (data) via PostgREST, Supabase Auth (accounts,
   including an anonymous session for guests so carts persist without
   a login) and Supabase Storage (product/artisan photo uploads).
   Realtime (postgres_changes) means admin edits appear on the live
   storefront instantly, on every open tab, without reloads.

   Requires supabase-init.js to run first (see that file).
   ============================================================ */
(function (root) {
  var KEYS = { products: 'products', artisans: 'artisans', orders: 'orders', founders: 'founders' };

  var DEFAULT_PRODUCTS = [
    {id:"mayur-embroidered-tee",name:"Mayur Embroidered Tee",category:"custom-tshirts",technique:"embroidery",tagline:"Hand-Embroidery | Organic Cotton",price:3499,mrp:4999,stock:24,status:"active",featured:true,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuAqsyX3913LsvZBSkdz8wmnx0qs5jhxRU6vzb1dKFMNQZK7Os41syw7n5oReCHBnsloXIwYAzPb42HqTNeG3t4NPOftmYradAxWRJXnzNv1YSu0FJHcA5V8vCDGSajw1IV_po9eHQ-rOwSfVTNHz4e0nIyxzK03l4Z1dVfuz3k-9R-ojEZ-mvmLXe0VL4v-5QPRK6fIO7emhDMS9BIwdHvFzxhoG4aUqPiqbMAd0JcObXV9h1vunaZG97FDbRosZqwRv60p2tq-I4RK"},
    {id:"banjara-patch-jacket",name:"Banjara Patch Jacket",category:"denim-jackets",technique:"patch-work",tagline:"Vintage Patchwork | Denim",price:9999,mrp:9999,stock:10,status:"active",featured:true,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuAjvXYweQjCFqX_SAS3TUvzlRxzREEfa1ga5cMHwLL1JSPs9hAdho1N5UHWgT6sMroKyRLlih6Gi6GG3nN0hJBec-VvGwCeBxAIc7jlEcx_stq_Wr6ZozLwbya1MCgSrB-dXRX4BRuD6DVMsitu_wi22mICtYzCrDgjnPVF4PkeiySads1z49BrmObaytRU-IUFh1kvtKQw3AgUJZe_1C62sZsS5DJkrfNHQMrJ_NWBYv3wPMM_ouVBBuWed7p2362IMjwhGI226Iar"},
    {id:"emerald-silk-clutch",name:"Emerald Silk Clutch",category:"accessories",technique:"beadwork",tagline:"Hand-Woven | Raw Silk",price:7999,mrp:7999,stock:15,status:"active",featured:true,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuDvx3lfMlm02wuILrsjmu0uqWDlO88676EruWJIOkl05KzNVxC_FZlo5RAzo1pKQVMVkO5mi9Zw332a3FB-LerYR4ta5D8nlfUxHT_VvgRPDUWGuD1YRB9gJc5hVcOqkG9N3ud_D85F_Sc9sshiPYoPCDPyuN-jrFest_G_TX8bLoSlIGRmIDvjmgRbr650hsH-6fg9HQehcSaMyS1n_ERjEHFfsTxRQZ66KdFQAGx4mCn7YqcvuaY41YqUAQkI_Y3ORTtK7vSxe4xu"},
    {id:"udaipur-linen-shirt",name:"Udaipur Linen Shirt",category:"shirts",technique:"embroidery",tagline:"Subtle Embroidery | Belgian Linen",price:5499,mrp:5499,stock:18,status:"active",featured:true,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuBEazU7tFLxOoYQ0MV1X6n796zsBRbcAoW6R4pX-tasX1tyLzowptjjFLlFP1PCGE8jXTUXP6JJl0zP1W3q3zOtstX_-pxRgO0cJUSAKd2TRIjJMZdCsWqQ6fIxSOqH-MvKDwHpRFDlH5B22frUwJMqhRF4w7RSVoFx9KyvlBQHlWrYvNg24rOTNIUlH69dPgWLnzqhqYBQvCgt0SRHd6DRGJfleptDKwrDnOlzggoGxieUKJs8Owqa8wtye19w1XwPmCLp6oeAVzOO"},
    {id:"glass-bead-geo-tee",name:"Glass Bead Geo-Tee",category:"custom-tshirts",technique:"beadwork",tagline:"Beadwork | Pima Cotton",price:3999,mrp:3999,stock:20,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuB6w20ghH-HKIK0pfG0XtPpysbUzvQZLjjoS7_vw_UBScX8X7mfbl3DKQQ9lYhCFHZBHAQwsMFt4O_ELQS3IWXBKIahqtvr3KiaA0CTUJVViPyrltYbipXQw5J43MU85vTouLHR4fBWCttw4zcFWNt_fS1y_MA4sleAeyG_K0g5wpunppM8RxXhgDnTk9EnK7urR4r7yDMSLUWk88zp-X6uHw7N4m9xTYn2Bg5RNiQbR-UhrayFprxK9z-tIg6mOUPFBUwAtqcHAEOE"},
    {id:"terracotta-canvas-tote",name:"Terracotta Canvas Tote",category:"handbags",technique:"embroidery",tagline:"Hand-Dyed | Heavy Canvas",price:4499,mrp:4499,stock:12,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuBXo_Kp5NDC4Eb7LHzO8jI6DhS3qF8X6zHTfLgH9Qz0sO92A9YPmOK2owzz-l9F_XLwlMUOJKe60Ck_rNiZjNmudROMeuvQcmCUgdegwFHowM0YI4lxFxOCcJ0yjdyW0_CWuwkW-DMjJUZUc0pvL4GGe1jn10bM_h0ojO1KIjHEyImB_Cb5snjRHunhZUA_2531suYWrtyStk1RMsUIV9epJLBGGj8OVUG9aDWeRMJAGU647Bf0Wz6Uwud5oAfT7uwiEUqOv6u6x3M0"},
    {id:"floral-painted-denim",name:"Floral Painted Denim",category:"denim-jackets",technique:"hand-painted",tagline:"Hand-Painted | Washed Denim",price:7499,mrp:7499,stock:8,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuBXjffAGo0_XtuiniR88UzsLqRCz9qL6nsVAv_C1Sd8bb3o-oehDeouvMdweJpbY0_JNGinDLojnJFr3xGNhaBfM6BIYCnu2ioY8IBcd1XeW9BwtoJS4dxHmNwZ_fkaVukzh--PagUBzuvMrcbbzF6tnnP7Ebf4UJ9tfcUgUWtfXoBfSHA5tyj0CIngi6A-BFFyTaQYW7RMELM8EXHtms9a1P9Kjh8P-myQiG2b5b-SIiB0oJbHApzQ0j-QKVRJ8euGUN9EbySHD5IX"},
    {id:"block-print-mules",name:"Block Print Mules",category:"accessories",technique:"block-print",tagline:"Textile Inlay | Suede & Cotton",price:6499,mrp:6499,stock:14,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuB2MzqTV2B3eD7eKchPDNTInsBeInS0s1QC1zd_4H3kTTmtkt3nZrINfI84OUpY2EoMMNyYEZwSTMrmnBiKrprpqPfnDyqjvOjea-RtQrRbtXctJJzdBrhYh0S5qRwd2sLV7SAxpBb72NcIH6wiqIZ5wXEtuha3Fws8A3aH12VDCH7dM_ThSVXhkGojxSJd2GY1sSjHNt5tM2a-Ule5b76b0o0W0cHNSesRT9dEcy3johid6zcsuG8e1olqxvI3djXMf9eHdaAx5j5I"},
    {id:"udaipur-linen-trousers",name:"Udaipur Linen Trousers",category:"bottoms",technique:"embroidery",tagline:"Tailored Fit | Pure Linen",price:6499,mrp:6499,stock:16,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuCe6Yd9CfYq9it3zdSncDhpW6ZZjnbNCVaGdePyMjTySWoL1Dt9CEVmbkc3Nw5Z80uhgwsXnOznGwGnS1_560ivHxe3MNXv5SlLS2md4P5LKWisLP3vSZZc6vqnkCdOt-aDiKIoX7YyYDaEkw-AOyK2hs1D9aA3PKxUmLhmL0qe1gZcqzF7y8Ga99zpT6SR01HCyRreLteBvH6N5yNh4LDYCPdyeA-zOI5ww4Sry2010covgwCSqniJIXW9hDtU_Nigg6LwEPKxc6kG"},
    {id:"indigo-silk-block-scarf",name:"Indigo Silk Block Scarf",category:"accessories",technique:"block-print",tagline:"Hand Block-Printed | Mulberry Silk",price:2499,mrp:2499,stock:30,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuC-t2uzOQIH6O_YNK9SVVRjdsSTOTFBBMTeq8WjMusL11kUyBw4dgKIERYs97BlEjD9vmlVxIzixWtsM8IHHoOqpxar5Cg-4RXugZv6trOZpk_P0igO1eWgQlnkKkWlIRb0_RYyyZEMDfitu1uGjpNAp1iIintMG3Lf3onON0QOjUyMOFP7q3J40ZDIc1t3i0YOJjqctnYbGUa0ju7abL0iVbj8vXLhgznIIq0UVQ2xXD2XZyUqnea6FlsJUORvQqqX6zDCwOav5oul"},
    {id:"tan-leather-mojaris",name:"Tan Leather Mojaris",category:"accessories",technique:"embroidery",tagline:"Hand-Stitched | Vegetable-Tanned Leather",price:3999,mrp:3999,stock:22,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuDRWx80JBBaiEPccrhngxsupDPjJExeCZYGKQEREPXXa6Ct6aKTnOb1viLN9_B5SL89jqbb1sECt-SQjeLjn4z65pHU_E1mnlhI0Q068vCgP6upddrwAGGRV_ctyaP0tnqat6l9h894DPLQJcEQ5S-ZC0L65PeDOLVD1Eu4URgc49WF-awYzEzc2lb-jORdodu972griIa858w_JocBXJfM1zbRiGwG7TyuVQpqAnBOvwUGvHrfCYv61iRaAc2BdFX-fyjwK2yNW7tS"},
    {id:"heritage-canvas-tote",name:"Heritage Canvas Tote",category:"handbags",technique:"embroidery",tagline:"Hand-Embroidered | Heavy Canvas",price:1999,mrp:1999,stock:25,status:"active",featured:false,img:"https://lh3.googleusercontent.com/aida-public/AB6AXuCJNBI9up-ZGedsF3fww2O6wWKoue49dHfsW_j2R4hQrCIXx_W9luFgO1bq-71wO_vRyvGzFN73kYrR7vWBtUDY5SbEwuHWz8TA6vPtUipo1vs60lW58RcIO_ktUJT73ZPRPjkUxrscz8oAcCAf8-HYsFvN_duUbF2lCvDXYdi5q0_intXh8L-fHo5i-yuLatiO2n1-rwYkiRxMNwkdU80eIsWnTs1W7XqGnhdqY5NBn3yaKbDXOeGMyri8wrWSunmJTfxJw1Ap_n_c"}
  ];

  var DEFAULT_ARTISANS = [
    {id:"anandi-devi",name:"Anandi Devi",role:"Master of Hand Embroidery",quote:"Every stitch I make is a bridge between the traditions of my grandmother and the dreams I have for my granddaughters.",tags:["Aari Technique","12 Years Exp."],img:"https://lh3.googleusercontent.com/aida-public/AB6AXuDxqW5rhHchxS0n_lWrGoJSsE071YhAjKazyIgKcTArgHmxHuk_f42GXcPoz1GKnVLCSBNQm6hDTjGQehEac7hJA0gdRUoW_PnZ-8qApxi-cT7ng0SuBQL1eJgkmsfvzORxxXUS5s2dxE7UITJUsPML2tVd6BOHyv5TwWANVtmYn73oZWEC7FmqABi-BHczX0R0xlc_wuvDDTXiDIZ0Fkie9e5Wl33Uh-OfUSY1dVHxjU0k1Q5ROsCztfWItRKUscHOxYm2VnQod436"},
    {id:"meera-singh",name:"Meera Singh",role:"Bead Work Specialist",quote:"Precision is my language. Through beadwork, I find a meditative rhythm that brings peace to my busy days.",tags:["Glass Beading","5 Years Exp."],img:"https://lh3.googleusercontent.com/aida-public/AB6AXuACDZ6O_SLEbUElZ0Ww88XePkNh09yJk115WI-qEYK9ko6ZI5vwe0Eg13xGWLXuF7Q9MyGuKZlU6ZL0HjiI6IRJJOCUxR1tsrZp_BIqb7QuxtS5uEdoiSjNI-ZECJ1Kuhg90_vcxl5_gM2cW0t5qkFTmYo-lmQotioUJnk_1SPXo68tdBzYDnHSK0eVBDB12Zkz1qGE2_orNiXzhqXoabBnP_BXq-5my0A9Z8K8Ox0RDRGusgtZ7l1o5ylebKmaNBouAOYtffWtoRzG"}
  ];

  var DEFAULT_FOUNDERS = [
    {id:"founder-ceo",name:"Add Your Name",role:"Founder & CEO",quote:"Replace this with your own story — why you started mistiCRAFT and what you want it to stand for.",img:"https://placehold.co/400x400/2a2620/e8c165?text=Founder+%26+CEO"},
    {id:"co-founder",name:"Add Co-Founder Name",role:"Co-Founder",quote:"Replace this with your co-founder's story, or delete this card from the admin panel if there isn't one.",img:"https://placehold.co/400x400/2a2620/e8c165?text=Co-Founder"}
  ];

  var DEFAULT_ORDERS = [
    {id:"MC-4029",unit:"Zardozi Collective",status:"Shipped",amount:12400},
    {id:"MC-4030",unit:"Hathi Pol Pottery",status:"Processing",amount:5850},
    {id:"MC-4031",unit:"Lake City Silks",status:"Pending",amount:28200},
    {id:"MC-4032",unit:"Zardozi Collective",status:"Shipped",amount:9100},
    {id:"MC-4033",unit:"Udaipur Block Printers",status:"On Hold",amount:4300}
  ];

  var CATEGORY_LABELS = {
    'custom-tshirts':'Custom T-Shirts','shirts':'Shirts','denim-jackets':'Denim Jackets',
    'handbags':'Handbags','accessories':'Accessories','bottoms':'Bottoms'
  };
  var TECHNIQUE_LABELS = {
    'embroidery':'Embroidery','patch-work':'Patch Work','beadwork':'Beadwork',
    'hand-painted':'Hand-Painted','block-print':'Block Print'
  };


  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function formatINR(n) {
    n = Math.round(Number(n) || 0);
    return '\u20B9' + n.toLocaleString('en-IN');
  }

  /* Indian PIN code -> {city, state} lookup, used to auto-fill address
     forms. Free, no-key public API (India Post data). Returns null on
     any failure (invalid/unknown PIN, network error) so callers can
     just leave the city/state fields for the user to fill manually. */
  async function lookupPincode(pin) {
    if (!/^[1-9][0-9]{5}$/.test(String(pin || ''))) return null;
    try {
      var res = await fetch('https://api.postalpincode.in/pincode/' + pin);
      var data = await res.json();
      var entry = data && data[0];
      var po = entry && entry.Status === 'Success' && entry.PostOffice && entry.PostOffice[0];
      if (!po) return null;
      return { city: po.District || '', state: po.State || '' };
    } catch (e) {
      console.error('mistiCRAFT pincode lookup error', e);
      return null;
    }
  }

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 7);
  }

  function slugify(s) {
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || uid('item');
  }

  function genUUID() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function db() {
    if (typeof window === 'undefined' || !window.sb) {
      throw new Error('Supabase is not initialized — check supabase-init.js and your network connection.');
    }
    return window.sb;
  }

  /* ---------- Generic table read/write (products, artisans, orders) ----------
     Keeps the exact loadData/saveData contract the storefront pages already
     use, just backed by Postgres tables instead of window.storage/Firestore. */
  async function loadData(key, seed) {
    try {
      var client = db();
      var res = await client.from(key).select('*');
      if (res.error) throw res.error;
      var data = res.data || [];
      if (data.length === 0 && seed && seed.length) {
        var ins = await client.from(key).insert(seed);
        if (ins.error) throw ins.error;
        res = await client.from(key).select('*');
        if (res.error) throw res.error;
        data = res.data || [];
      }
      return data.length ? data : clone(seed);
    } catch (e) {
      console.error('mistiCRAFT loadData error (' + key + ')', e);
      return clone(seed);
    }
  }

  async function saveData(key, data) {
    try {
      var client = db();
      var existing = await client.from(key).select('id');
      if (existing.error) throw existing.error;
      var keep = {};
      data.forEach(function (item) { keep[String(item.id)] = true; });
      var toDelete = (existing.data || []).filter(function (r) { return !keep[String(r.id)]; }).map(function (r) { return r.id; });
      if (toDelete.length) {
        var del = await client.from(key).delete().in('id', toDelete);
        if (del.error) throw del.error;
      }
      if (data.length) {
        var up = await client.from(key).upsert(data, { onConflict: 'id' });
        if (up.error) throw up.error;
      }
      return true;
    } catch (e) {
      console.error('mistiCRAFT saveData error (' + key + ')', e);
      return false;
    }
  }

  /* Live updates: call once, get called back on every change (including
     immediately with current data). Returns an unsubscribe function. */
  function subscribe(key, onData) {
    try {
      var client = db();
      var refetch = async function () {
        var res = await client.from(key).select('*');
        if (!res.error) onData(res.data || []);
        else console.error('mistiCRAFT subscribe refetch error (' + key + ')', res.error);
      };
      refetch();
      var channel = client.channel('mc-' + key + '-' + Math.random().toString(36).slice(2, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: key }, refetch)
        .subscribe();
      return function () { client.removeChannel(channel); };
    } catch (e) {
      console.error('mistiCRAFT subscribe init error (' + key + ')', e);
      return function () {};
    }
  }

  /* ---------------- Auth ---------------- */
  var authReadyResolve;
  var authReadyPromise = new Promise(function (res) { authReadyResolve = res; });
  var authReadyDone = false;
  var cachedUser = null;

  async function initAuthWatcher() {
    var client = db();
    client.auth.onAuthStateChange(function (_event, session) {
      cachedUser = session ? session.user : null;
      document.dispatchEvent(new CustomEvent('mistiauth:change', { detail: { user: cachedUser } }));
    });
    try {
      var got = await client.auth.getSession();
      if (got.data && got.data.session && got.data.session.user) {
        cachedUser = got.data.session.user;
      } else {
        var anon = await client.auth.signInAnonymously();
        if (anon.error) throw anon.error;
        cachedUser = anon.data.user;
      }
    } catch (e) {
      console.error('mistiCRAFT anonymous sign-in error', e);
      cachedUser = null;
    }
    authReadyDone = true;
    authReadyResolve(cachedUser);
  }
  if (typeof window !== 'undefined' && window.sb) initAuthWatcher();

  function authReady() { return authReadyPromise; }
  function currentUser() { return cachedUser; }
  function onAuthChange(cb) {
    try {
      return db().auth.onAuthStateChange(function (_event, session) { cb(session ? session.user : null); });
    } catch (e) {
      console.error('mistiCRAFT onAuthChange init error', e);
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
  }

  async function mergeGuestData(fromUid, toUid) {
    try {
      var fromCart = await cartGet(fromUid);
      if (fromCart.length) {
        var toCart = await cartGet(toUid);
        await cartSet(toUid, mergeCartArrays(toCart, fromCart));
        await cartSet(fromUid, []);
      }
    } catch (e) { console.error('mistiCRAFT cart merge error', e); }
    try {
      var fromWish = await wishlistGet(fromUid);
      if (fromWish.length) {
        var toWish = await wishlistGet(toUid);
        await wishlistSet(toUid, mergeUniqueById(toWish, fromWish));
      }
    } catch (e) { console.error('mistiCRAFT wishlist merge error', e); }
  }

  function mergeCartArrays(a, b) {
    var out = clone(a);
    b.forEach(function (item) {
      var existing = out.find(function (x) { return x.id === item.id && x.size === item.size; });
      if (existing) existing.qty = Math.min(9, existing.qty + item.qty);
      else out.push(item);
    });
    return out;
  }
  function mergeUniqueById(a, b) {
    var out = clone(a);
    b.forEach(function (item) {
      if (!out.find(function (x) { return x.id === item.id; })) out.push(item);
    });
    return out;
  }

  /* Sign up: upgrades the current anonymous session in place (same uid,
     so cart/wishlist carry over) if one exists, else creates a fresh
     account. NOTE: with Supabase's default settings, this may require
     the person to confirm a link sent to their email before the identity
     fully attaches — see SETUP-SUPABASE.md to toggle that requirement. */
  async function signUp(email, password, name) {
    var client = db();
    var user = cachedUser;
    var result;
    if (user && user.is_anonymous) {
      result = await client.auth.updateUser({ email: email, password: password, data: name ? { name: name } : undefined });
    } else {
      result = await client.auth.signUp({ email: email, password: password, options: name ? { data: { name: name } } : undefined });
    }
    if (result.error) throw result.error;
    var resultUser = result.data.user;
    if (resultUser) await saveProfile(resultUser.id, { name: name || '', email: email });
    return resultUser;
  }

  async function logIn(email, password) {
    var client = db();
    var prev = cachedUser;
    var prevUid = (prev && prev.is_anonymous) ? prev.id : null;
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    if (prevUid && result.data.user && prevUid !== result.data.user.id) {
      await mergeGuestData(prevUid, result.data.user.id);
    }
    return result.data.user;
  }

  function logOut() {
    try { return db().auth.signOut(); }
    catch (e) { console.error('mistiCRAFT logOut error', e); return Promise.resolve({ error: e }); }
  }

  async function isAdmin(uid) {
    if (!uid) return false;
    try {
      var res = await db().from('admins').select('uid').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return !!res.data;
    } catch (e) { console.error('mistiCRAFT isAdmin error', e); return false; }
  }

  async function getProfile(uid) {
    try {
      var res = await db().from('profiles').select('*').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return res.data || null;
    } catch (e) { console.error('mistiCRAFT getProfile error', e); return null; }
  }
  async function saveProfile(uid, patch) {
    try {
      var payload = Object.assign({ uid: uid }, patch);
      var res = await db().from('profiles').upsert(payload, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT saveProfile error', e); return false; }
  }

  /* ---------------- Store settings (single row, id=1) ---------------- */
  async function getSettings() {
    try {
      var res = await db().from('settings').select('*').eq('id', 1).maybeSingle();
      if (res.error) throw res.error;
      return res.data || { shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '' };
    } catch (e) {
      console.error('mistiCRAFT getSettings error', e);
      return { shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '' };
    }
  }
  function subscribeSettings(cb) {
    try {
      var client = db();
      var refetch = async function () { cb(await getSettings()); };
      refetch();
      var channel = client.channel('mc-settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, refetch)
        .subscribe();
      return function () { client.removeChannel(channel); };
    } catch (e) {
      console.error('mistiCRAFT subscribeSettings init error', e);
      cb({ shipping_fee: 99, store_email: '', store_phone: '', default_transporter: '', upi_id: '', upi_payee_name: '' });
      return function () {};
    }
  }
  async function saveSettings(patch) {
    try {
      var payload = Object.assign({ id: 1 }, patch);
      var res = await db().from('settings').upsert(payload, { onConflict: 'id' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT saveSettings error', e); return false; }
  }

  /* ---------------- Cart (one row per user: carts.uid) ---------------- */
  async function cartGet(uid) {
    try {
      var res = await db().from('carts').select('items').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return (res.data && res.data.items) || [];
    } catch (e) { console.error('mistiCRAFT cartGet error', e); return []; }
  }
  async function cartSet(uid, items) {
    try {
      var res = await db().from('carts').upsert({ uid: uid, items: items, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT cartSet error', e); return false; }
  }
  function cartSubscribe(uid, cb) {
    var client = db();
    var refetch = async function () { cb(await cartGet(uid)); };
    refetch();
    var channel = client.channel('mc-cart-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carts', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  async function cartAdd(uid, item) {
    var items = await cartGet(uid);
    var existing = items.find(function (x) { return x.id === item.id && x.size === item.size; });
    if (existing) existing.qty = Math.min(9, existing.qty + (item.qty || 1));
    else items.push(Object.assign({ qty: 1, size: null }, item));
    await cartSet(uid, items);
    return items;
  }
  async function cartUpdateQty(uid, id, size, qty) {
    var items = await cartGet(uid);
    var it = items.find(function (x) { return x.id === id && x.size === size; });
    if (it) it.qty = Math.max(1, Math.min(9, qty));
    await cartSet(uid, items);
    return items;
  }
  async function cartRemove(uid, id, size) {
    var items = await cartGet(uid);
    items = items.filter(function (x) { return !(x.id === id && x.size === size); });
    await cartSet(uid, items);
    return items;
  }
  async function cartClear(uid) { await cartSet(uid, []); }

  /* ---------------- Wishlist (one row per user: wishlists.uid) ---------------- */
  async function wishlistGet(uid) {
    try {
      var res = await db().from('wishlists').select('items').eq('uid', uid).maybeSingle();
      if (res.error) throw res.error;
      return (res.data && res.data.items) || [];
    } catch (e) { console.error('mistiCRAFT wishlistGet error', e); return []; }
  }
  async function wishlistSet(uid, items) {
    try {
      var res = await db().from('wishlists').upsert({ uid: uid, items: items, updated_at: new Date().toISOString() }, { onConflict: 'uid' });
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT wishlistSet error', e); return false; }
  }
  function wishlistSubscribe(uid, cb) {
    var client = db();
    var refetch = async function () { cb(await wishlistGet(uid)); };
    refetch();
    var channel = client.channel('mc-wishlist-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  async function wishlistToggle(uid, product) {
    var items = await wishlistGet(uid);
    var idx = items.findIndex(function (x) { return x.id === product.id; });
    var added;
    if (idx > -1) { items.splice(idx, 1); added = false; } else { items.push(product); added = true; }
    await wishlistSet(uid, items);
    return { items: items, added: added };
  }

  /* ---------------- Customer orders (created at checkout) ----------------
     Kept separate from the `orders` table above, which powers the existing
     Workshop Admin "Order Fulfillment" board (production orders placed
     with artisan units — a different concept from a shopper's purchase).
     DB columns are snake_case (order_number, created_at); normalizeOrderRow
     maps them to the camelCase shape the rest of the app already expects. */
  function normalizeOrderRow(row) {
    if (!row) return row;
    return {
      id: row.id,
      orderNumber: row.order_number || row.orderNumber,
      uid: row.uid,
      items: row.items || [],
      subtotal: row.subtotal,
      shipping: row.shipping,
      total: row.total,
      contact: row.contact || {},
      address: row.address || {},
      payment: row.payment || {},
      status: row.status,
      transporter: row.transporter || '',
      trackingId: row.tracking_id || row.trackingId || '',
      createdAt: row.created_at ? new Date(row.created_at).getTime() : (row.createdAt || Date.now())
    };
  }
  async function createOrder(order) {
    var client = db();
    var id = genUUID();
    var orderNumber = 'MC-' + id.replace(/-/g, '').slice(-6).toUpperCase();
    var payload = {
      id: id,
      order_number: orderNumber,
      uid: order.uid,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      contact: order.contact,
      address: order.address,
      payment: order.payment,
      status: 'Pending'
    };
    var res = await client.from('customer_orders').insert(payload);
    if (res.error) throw res.error;
    return normalizeOrderRow(Object.assign({ created_at: new Date().toISOString() }, payload));
  }
  function subscribeCustomerOrders(cb) {
    var client = db();
    var refetch = async function () {
      var res = await client.from('customer_orders').select('*').order('created_at', { ascending: false });
      if (!res.error) cb((res.data || []).map(normalizeOrderRow));
      else console.error('mistiCRAFT customerOrders subscribe error', res.error);
    };
    refetch();
    var channel = client.channel('mc-customer-orders-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  function subscribeUserOrders(uid, cb) {
    var client = db();
    var refetch = async function () {
      var res = await client.from('customer_orders').select('*').eq('uid', uid).order('created_at', { ascending: false });
      if (!res.error) cb((res.data || []).map(normalizeOrderRow));
      else console.error('mistiCRAFT user orders subscribe error', res.error);
    };
    refetch();
    var channel = client.channel('mc-customer-orders-user-' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders', filter: 'uid=eq.' + uid }, refetch)
      .subscribe();
    return function () { client.removeChannel(channel); };
  }
  async function updateCustomerOrderStatus(orderId, status) {
    try {
      var res = await db().from('customer_orders').update({ status: status }).eq('id', orderId);
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT updateCustomerOrderStatus error', e); return false; }
  }
  async function updateOrderLogistics(orderId, logistics) {
    try {
      var res = await db().from('customer_orders').update({
        transporter: logistics.transporter || null,
        tracking_id: logistics.trackingId || null
      }).eq('id', orderId);
      if (res.error) throw res.error;
      return true;
    } catch (e) { console.error('mistiCRAFT updateOrderLogistics error', e); return false; }
  }
  async function decrementStock(items) {
    try {
      var client = db();
      for (var i = 0; i < items.length; i++) {
        var got = await client.from('products').select('stock').eq('id', items[i].id).maybeSingle();
        if (got.error) throw got.error;
        if (got.data) {
          var newStock = Math.max(0, (got.data.stock || 0) - items[i].qty);
          var upd = await client.from('products').update({ stock: newStock }).eq('id', items[i].id);
          if (upd.error) throw upd.error;
        }
      }
      return true;
    } catch (e) { console.error('mistiCRAFT decrementStock error', e); return false; }
  }

  /* ---------------- Image upload (Storage) ----------------
     Downscales large photos client-side first (longest edge capped) so
     uploads stay fast and product pages stay light. `folder` looks like
     'product-images/<id>' — the part before the first slash is the
     Storage bucket name, the rest is the path within that bucket. */
  function resizeImageFile(file, maxDim) {
    maxDim = maxDim || 1600;
    return new Promise(function (resolve) {
      if (!file.type || file.type.indexOf('image/') !== 0) { resolve(file); return; }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.width, h = img.height;
        if (w <= maxDim && h <= maxDim) { resolve(file); return; }
        var scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale); h = Math.round(h * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  async function uploadImage(file, folder, onProgress) {
    var resized = await resizeImageFile(file, 1600);
    var safeName = Date.now() + '-' + String(file.name || 'image.jpg').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    var slashIdx = folder.indexOf('/');
    var bucket = slashIdx > -1 ? folder.slice(0, slashIdx) : folder;
    var subPath = slashIdx > -1 ? folder.slice(slashIdx + 1) : '';
    var path = (subPath ? subPath + '/' : '') + safeName;
    var client = db();
    var res = await client.storage.from(bucket).upload(path, resized, {
      contentType: 'image/jpeg',
      upsert: true,
      onUploadProgress: function (progress) {
        if (typeof onProgress === 'function' && progress && progress.total) {
          onProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      }
    });
    if (res.error) throw res.error;
    var pub = client.storage.from(bucket).getPublicUrl(path);
    return pub.data.publicUrl;
  }

  /* ---------------- Cart badge auto-hydration ----------------
     Runs on every page once this script loads: as soon as we know who
     the visitor is (real account or anonymous session), watch their
     cart and keep any #cart-badge element in the header in sync live. */
  function watchCartBadge() {
    authReady().then(function (user) {
      if (!user) return;
      cartSubscribe(user.id, function (items) {
        var badge = document.getElementById('cart-badge');
        if (!badge) return;
        var count = items.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
        badge.textContent = String(count);
      });
    });
  }
  if (typeof document !== 'undefined') watchCartBadge();

  root.mistiData = {
    KEYS: KEYS,
    DEFAULT_PRODUCTS: DEFAULT_PRODUCTS,
    DEFAULT_ARTISANS: DEFAULT_ARTISANS,
    DEFAULT_ORDERS: DEFAULT_ORDERS,
    DEFAULT_FOUNDERS: DEFAULT_FOUNDERS,
    CATEGORY_LABELS: CATEGORY_LABELS,
    TECHNIQUE_LABELS: TECHNIQUE_LABELS,
    loadData: loadData,
    saveData: saveData,
    subscribe: subscribe,
    formatINR: formatINR,
    lookupPincode: lookupPincode,
    uid: uid,
    slugify: slugify,
    authReady: authReady,
    currentUser: currentUser,
    onAuthChange: onAuthChange,
    signUp: signUp,
    logIn: logIn,
    logOut: logOut,
    isAdmin: isAdmin,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getSettings: getSettings,
    subscribeSettings: subscribeSettings,
    saveSettings: saveSettings,
    cart: { get: cartGet, set: cartSet, subscribe: cartSubscribe, add: cartAdd, updateQty: cartUpdateQty, remove: cartRemove, clear: cartClear },
    wishlist: { get: wishlistGet, set: wishlistSet, subscribe: wishlistSubscribe, toggle: wishlistToggle },
    orders: { create: createOrder, subscribeAll: subscribeCustomerOrders, subscribeForUser: subscribeUserOrders, updateStatus: updateCustomerOrderStatus, updateLogistics: updateOrderLogistics, decrementStock: decrementStock },
    uploadImage: uploadImage
  };
})(window);
