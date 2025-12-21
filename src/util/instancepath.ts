export function getInstanceFromPath( root: Instance, path: string[] ) 
{
  let currentInstance = root;

  for ( const entry of path )
    currentInstance = currentInstance.WaitForChild( entry );

  return currentInstance;
}