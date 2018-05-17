M.AutoInit();





  document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.collapsible');
    const options ={};
    var instances = M.Collapsible.init(elems, options={});
  });

  