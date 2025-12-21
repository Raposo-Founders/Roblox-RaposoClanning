function StartControllers( parentObject: Record<string, unknown> ) 
{
  for ( const inst of script.GetChildren() ) 
  {
    if ( !inst.IsA( "ModuleScript" ) ) continue;

    task.spawn( () => 
    {
      const obj = require( inst );
      parentObject[inst.Name] = obj;
    } );
  }
}

export = StartControllers;