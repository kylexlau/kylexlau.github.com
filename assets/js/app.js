$('.active').removeClass('active');

$(".nav li a").filter(function() {
    return $(this).prop("href").toUpperCase() == window.location.href.toUpperCase();
}).addClass("active")
